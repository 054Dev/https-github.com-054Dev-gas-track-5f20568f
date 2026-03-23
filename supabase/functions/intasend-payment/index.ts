import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Daraja sandbox URLs
const DARAJA_AUTH_URL = "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials";
const DARAJA_STK_URL = "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest";
const DARAJA_STK_QUERY_URL = "https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query";
const BUSINESS_SHORT_CODE = "174379"; // Sandbox shortcode

// Helper: get Daraja OAuth token
async function getDarajaToken(): Promise<string> {
  const consumerKey = Deno.env.get("DARAJA_CONSUMER_KEY");
  const consumerSecret = Deno.env.get("DARAJA_CONSUMER_SECRET");
  if (!consumerKey || !consumerSecret) throw new Error("Daraja credentials not configured");

  const auth = btoa(`${consumerKey}:${consumerSecret}`);
  const res = await fetch(DARAJA_AUTH_URL, {
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Daraja auth failed [${res.status}]: ${errText}`);
  }
  const data = await res.json();
  return data.access_token;
}

// Helper: generate STK push password
function generatePassword(timestamp: string): string {
  const passkey = Deno.env.get("DARAJA_PASSKEY") || "";
  const raw = `${BUSINESS_SHORT_CODE}${passkey}${timestamp}`;
  return btoa(raw);
}

// Helper: format phone for Daraja (254XXXXXXXXX)
function formatPhone(phone: string): string {
  let cleaned = phone.replace(/[\s\-\+]/g, "");
  if (cleaned.startsWith("0")) cleaned = "254" + cleaned.slice(1);
  if (cleaned.startsWith("+")) cleaned = cleaned.slice(1);
  if (!cleaned.startsWith("254")) cleaned = "254" + cleaned;
  return cleaned;
}

// Helper function to verify authentication
async function verifyAuth(req: Request, supabaseAdmin: any): Promise<{ userId: string | null; error?: string }> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { userId: null, error: 'Unauthorized: No authorization header' };
  }

  const token = authHeader.replace('Bearer ', '');
  const { data, error: authError } = await supabaseAdmin.auth.getClaims(token);

  if (authError || !data?.claims) {
    return { userId: null, error: 'Unauthorized: Invalid token' };
  }

  return { userId: data.claims.sub };
}

// Helper function to verify admin/staff role
async function verifyAdminRole(supabaseAdmin: any, userId: string): Promise<boolean> {
  const { data: roleData } = await supabaseAdmin
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .in('role', ['admin', 'co_admin', 'staff'])
    .maybeSingle();

  return !!roleData;
}

// Helper function to verify customer ownership or admin role
async function verifyCustomerAccess(
  supabaseAdmin: any,
  userId: string,
  customerId: string
): Promise<{ authorized: boolean; isAdmin: boolean }> {
  const isAdmin = await verifyAdminRole(supabaseAdmin, userId);
  if (isAdmin) return { authorized: true, isAdmin: true };

  const { data: customer } = await supabaseAdmin
    .from('customers')
    .select('user_id')
    .eq('id', customerId)
    .single();

  if (customer && customer.user_id === userId) {
    return { authorized: true, isAdmin: false };
  }

  return { authorized: false, isAdmin: false };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const rawBody = await req.json();

    // Daraja sends callback directly with Body.stkCallback — no "action" field
    if (rawBody.Body?.stkCallback) {
      const callback = rawBody.Body.stkCallback;
      console.log("Daraja callback received:", JSON.stringify(callback));

      const resultCode = callback.ResultCode;
      if (resultCode === 0) {
        const items = callback.CallbackMetadata?.Item || [];
        const getMeta = (name: string) => items.find((i: any) => i.Name === name)?.Value;

        const amount = getMeta("Amount");
        const mpesaRef = getMeta("MpesaReceiptNumber");
        const phone = getMeta("PhoneNumber")?.toString();

        if (phone) {
          const phoneVariants = [
            `+${phone}`, phone, `0${phone?.slice(3)}`,
          ];
          const { data: customerMatch } = await supabaseAdmin
            .from("customers")
            .select("id, arrears_balance, email, in_charge_name")
            .or(phoneVariants.map(p => `phone.eq.${p}`).join(","))
            .maybeSingle();

          if (customerMatch) {
            const { data: payment } = await supabaseAdmin
              .from("payments")
              .insert({
                customer_id: customerMatch.id,
                amount_paid: parseFloat(amount),
                method: "mpesa",
                payment_provider: "daraja",
                payment_status: "completed",
                transaction_id: mpesaRef,
                reference: callback.CheckoutRequestID,
              })
              .select()
              .single();

            const newArrears = (customerMatch.arrears_balance || 0) - parseFloat(amount);
            await supabaseAdmin.from("customers").update({ arrears_balance: newArrears }).eq("id", customerMatch.id);

            if (customerMatch.email && payment) {
              try {
                const supabaseUrl = Deno.env.get("SUPABASE_URL");
                const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
                await fetch(`${supabaseUrl}/functions/v1/send-receipt-email`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", Authorization: `Bearer ${anonKey}` },
                  body: JSON.stringify({
                    paymentId: payment.id, customerEmail: customerMatch.email,
                    customerName: customerMatch.in_charge_name, amount: parseFloat(amount),
                    method: "mpesa", transactionId: mpesaRef, paidAt: payment.paid_at,
                  }),
                });
              } catch (e) { console.error("Receipt email error:", e); }
            }
            console.log(`Daraja payment recorded: KES ${amount}, ref ${mpesaRef}`);
          }
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, ...data } = rawBody;

    // ─── STK PUSH (M-Pesa payment) ────────────────────────────
    if (action === "initialize-payment") {
      const { userId, error: authError } = await verifyAuth(req, supabaseAdmin);
      if (authError || !userId) {
        return new Response(
          JSON.stringify({ error: authError }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { customerId, amount, deliveryId } = data;

      const { authorized } = await verifyCustomerAccess(supabaseAdmin, userId, customerId);
      if (!authorized) {
        return new Response(
          JSON.stringify({ error: "Not authorized to initiate payment for this customer" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("Initializing Daraja STK push:", { customerId, amount, deliveryId, userId });

      // Get customer phone
      const { data: customer, error: customerError } = await supabaseAdmin
        .from("customers")
        .select("*")
        .eq("id", customerId)
        .single();

      if (customerError || !customer) {
        return new Response(
          JSON.stringify({ error: "Customer not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const phone = formatPhone(customer.phone);
      const timestamp = new Date().toISOString().replace(/[-T:\.Z]/g, "").slice(0, 14);
      const password = generatePassword(timestamp);

      const token = await getDarajaToken();

      const callbackUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/intasend-payment`;

      const stkPayload = {
        BusinessShortCode: BUSINESS_SHORT_CODE,
        Password: password,
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: Math.ceil(amount), // Daraja requires integer
        PartyA: phone,
        PartyB: BUSINESS_SHORT_CODE,
        PhoneNumber: phone,
        CallBackURL: callbackUrl,
        AccountReference: deliveryId ? deliveryId.slice(0, 12) : `PAY${Date.now()}`,
        TransactionDesc: `Payment for gas delivery`,
      };

      const stkRes = await fetch(DARAJA_STK_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(stkPayload),
      });

      const stkData = await stkRes.json();
      console.log("Daraja STK response:", stkData);

      if (stkData.ResponseCode !== "0" && stkData.errorCode) {
        return new Response(
          JSON.stringify({ error: stkData.errorMessage || "STK push failed" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: "STK push sent. Check your phone for the M-Pesa prompt.",
          checkoutRequestId: stkData.CheckoutRequestID,
          merchantRequestId: stkData.MerchantRequestID,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }



    // ─── STK QUERY (check payment status) ─────────────────────
    if (action === "query-payment") {
      const { userId, error: authError } = await verifyAuth(req, supabaseAdmin);
      if (authError || !userId) {
        return new Response(
          JSON.stringify({ error: authError }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { checkoutRequestId } = data;
      const timestamp = new Date().toISOString().replace(/[-T:\.Z]/g, "").slice(0, 14);
      const password = generatePassword(timestamp);
      const token = await getDarajaToken();

      const queryRes = await fetch(DARAJA_STK_QUERY_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          BusinessShortCode: BUSINESS_SHORT_CODE,
          Password: password,
          Timestamp: timestamp,
          CheckoutRequestID: checkoutRequestId,
        }),
      });

      const queryData = await queryRes.json();
      return new Response(
        JSON.stringify({ success: true, data: queryData }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── CASH PAYMENT (admin records) ─────────────────────────
    if (action === "cash-payment") {
      const { userId, error: authError } = await verifyAuth(req, supabaseAdmin);
      if (authError || !userId) {
        return new Response(
          JSON.stringify({ error: authError }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const isAdmin = await verifyAdminRole(supabaseAdmin, userId);
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ error: "Admin access required to record cash payments" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { customerId, deliveryId, amount, handledBy } = data;

      if (!customerId || typeof amount !== 'number' || amount <= 0) {
        return new Response(
          JSON.stringify({ error: "Invalid payment data" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("Recording cash payment:", { customerId, amount, handledBy: userId });

      const { data: customer } = await supabaseAdmin
        .from("customers")
        .select("email, in_charge_name, arrears_balance")
        .eq("id", customerId)
        .single();

      if (!customer) {
        return new Response(
          JSON.stringify({ error: "Customer not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: payment, error: paymentError } = await supabaseAdmin
        .from("payments")
        .insert({
          customer_id: customerId,
          delivery_id: deliveryId,
          amount_paid: amount,
          method: "cash",
          payment_provider: "manual",
          payment_status: "completed",
          handled_by: userId,
          reference: `CASH-${Date.now()}`,
        })
        .select()
        .single();

      if (paymentError) {
        return new Response(
          JSON.stringify({ error: "Failed to record payment" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const newArrears = (customer.arrears_balance || 0) - amount;
      await supabaseAdmin
        .from("customers")
        .update({ arrears_balance: newArrears })
        .eq("id", customerId);

      // Send receipt email
      if (customer.email && payment) {
        try {
          const supabaseUrl = Deno.env.get("SUPABASE_URL");
          const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
          await fetch(`${supabaseUrl}/functions/v1/send-receipt-email`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${anonKey}`,
            },
            body: JSON.stringify({
              paymentId: payment.id,
              customerEmail: customer.email,
              customerName: customer.in_charge_name,
              amount,
              method: "cash",
              transactionId: payment.reference,
              paidAt: payment.paid_at,
            }),
          });
        } catch (emailError) {
          console.error("Failed to send receipt email:", emailError);
        }
      }

      return new Response(
        JSON.stringify({ success: true, payment, newArrears }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── OVERPAYMENT BILLING ──────────────────────────────────
    if (action === "overpayment-billing") {
      const { userId, error: authError } = await verifyAuth(req, supabaseAdmin);
      if (authError || !userId) {
        return new Response(
          JSON.stringify({ error: authError }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { customerId, deliveryId } = data;
      if (!customerId || !deliveryId) {
        return new Response(
          JSON.stringify({ error: "customerId and deliveryId are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const [{ data: customer }, { data: delivery }] = await Promise.all([
        supabaseAdmin
          .from("customers")
          .select("email, in_charge_name, arrears_balance")
          .eq("id", customerId)
          .single(),
        supabaseAdmin
          .from("deliveries")
          .select("total_charge, delivery_date")
          .eq("id", deliveryId)
          .single(),
      ]);

      if (!customer || !delivery) {
        return new Response(
          JSON.stringify({ error: "Customer or delivery not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const currentBalance = Number(customer.arrears_balance || 0);
      const orderCost = Number(delivery.total_charge);

      if (currentBalance >= 0) {
        return new Response(
          JSON.stringify({ success: true, message: "No credit to apply", creditApplied: 0 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const creditAvailable = Math.abs(currentBalance);
      const billedAmount = Math.min(creditAvailable, orderCost);
      const newArrears = currentBalance + billedAmount;

      const { data: payment, error: paymentError } = await supabaseAdmin
        .from("payments")
        .insert({
          customer_id: customerId,
          delivery_id: deliveryId,
          amount_paid: billedAmount,
          method: "overpayment",
          payment_provider: "system",
          payment_status: "completed",
          reference: `OVERPAY-${Date.now()}`,
          transaction_id: `OVP-${deliveryId.slice(0, 8)}-${Date.now()}`,
        })
        .select()
        .single();

      if (paymentError) {
        return new Response(
          JSON.stringify({ error: "Failed to record overpayment billing" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await supabaseAdmin
        .from("customers")
        .update({ arrears_balance: newArrears })
        .eq("id", customerId);

      if (customer.email && payment) {
        try {
          const supabaseUrl = Deno.env.get("SUPABASE_URL");
          const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
          await fetch(`${supabaseUrl}/functions/v1/send-receipt-email`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${anonKey}`,
            },
            body: JSON.stringify({
              paymentId: payment.id,
              customerEmail: customer.email,
              customerName: customer.in_charge_name,
              amount: billedAmount,
              method: "overpayment",
              transactionId: payment.reference,
              paidAt: new Date().toISOString(),
            }),
          });
        } catch (emailError) {
          console.error("Failed to send overpayment receipt email:", emailError);
        }
      }

      return new Response(
        JSON.stringify({ success: true, creditApplied: billedAmount, newArrears, payment }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
