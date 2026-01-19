import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper function to verify authentication
async function verifyAuth(req: Request, supabaseAdmin: any): Promise<{ user: any; error?: string }> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return { user: null, error: 'Unauthorized: No authorization header' };
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

  if (authError || !user) {
    return { user: null, error: 'Unauthorized: Invalid token' };
  }

  return { user };
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
  // Check if user is admin/staff
  const isAdmin = await verifyAdminRole(supabaseAdmin, userId);
  if (isAdmin) {
    return { authorized: true, isAdmin: true };
  }

  // Check if user owns the customer record
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
    // Use service role for backend operations
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { action, ...data } = await req.json();

    if (action === "initialize-payment") {
      // Verify authentication
      const { user, error: authError } = await verifyAuth(req, supabaseAdmin);
      if (authError) {
        return new Response(
          JSON.stringify({ error: authError }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { customerId, amount, deliveryId, paymentMethod } = data;

      // Verify user has access to this customer
      const { authorized } = await verifyCustomerAccess(supabaseAdmin, user.id, customerId);
      if (!authorized) {
        return new Response(
          JSON.stringify({ error: "Not authorized to initiate payment for this customer" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("Initializing payment:", { customerId, amount, deliveryId, paymentMethod, userId: user.id });

      const intasendApiKey = Deno.env.get("INTASEND_API_KEY");
      const intasendPublishableKey = Deno.env.get("INTASEND_PUBLISHABLE_KEY");

      // Get customer details using service role to bypass RLS
      const { data: customer, error: customerError } = await supabaseAdmin
        .from("customers")
        .select("*")
        .eq("id", customerId)
        .single();

      if (customerError || !customer) {
        console.error("Customer fetch error:", customerError);
        return new Response(
          JSON.stringify({ error: "Customer not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Map frontend payment methods to Intasend API method values
      const methodMap: Record<string, string> = {
        "mpesa": "M-PESA",
        "airtel-money": "M-PESA",
        "bank-transfer": "BANK-PAYMENT",
        "card": "CARD-PAYMENT"
      };
      
      const intasendMethod = methodMap[paymentMethod] || "M-PESA";

      // Create payment collection request
      const intasendResponse = await fetch("https://api.intasend.com/api/v1/payment/collection/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${intasendApiKey}`,
        },
        body: JSON.stringify({
          public_key: intasendPublishableKey,
          email: customer.email,
          phone_number: customer.phone,
          amount: amount,
          currency: "KES",
          api_ref: deliveryId || `payment-${Date.now()}`,
          method: intasendMethod,
          name: customer.in_charge_name,
        }),
      });

      if (!intasendResponse.ok) {
        const error = await intasendResponse.text();
        console.error("Intasend error:", error);
        return new Response(
          JSON.stringify({ error: `Payment provider error` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const paymentData = await intasendResponse.json();
      console.log("Payment initialized successfully");

      return new Response(
        JSON.stringify({ success: true, data: paymentData }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "webhook") {
      // Webhooks don't require auth - they come from Intasend
      console.log("Webhook received:", data);

      const { invoice_id, state, amount, currency, api_ref, account } = data;

      if (state === "COMPLETE") {
        // Find the delivery using service role
        const { data: delivery } = await supabaseAdmin
          .from("deliveries")
          .select("*, customers(*)")
          .eq("id", api_ref)
          .single();

        if (delivery) {

          const { data: payment, error: paymentError } = await supabaseAdmin
            .from("payments")
            .insert({
              customer_id: delivery.customer_id,
              delivery_id: delivery.id,
              amount_paid: parseFloat(amount),
              method: account || "mobile_money",
              payment_provider: "intasend",
              payment_status: "completed",
              transaction_id: invoice_id,
              reference: invoice_id,
            })
            .select()
            .single();

          if (paymentError) {
            console.error("Payment insert error:", paymentError);
            throw paymentError;
          }

          // Update customer arrears (allow negative for credits/overpayments)
          const newArrears = (delivery.customers.arrears_balance || 0) - parseFloat(amount);
          await supabaseAdmin
            .from("customers")
            .update({ arrears_balance: newArrears })
            .eq("id", delivery.customer_id);

          // Send receipt email if customer has email
          if (delivery.customers.email && payment) {
            try {
              const supabaseUrl = Deno.env.get("SUPABASE_URL");
              const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
              
              await fetch(`${supabaseUrl}/functions/v1/send-receipt-email`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${anonKey}`,
                },
                body: JSON.stringify({
                  paymentId: payment.id,
                  customerEmail: delivery.customers.email,
                  customerName: delivery.customers.in_charge_name,
                  amount: parseFloat(amount),
                  method: account || "mobile_money",
                  transactionId: invoice_id,
                  paidAt: payment.paid_at,
                }),
              });
              console.log("Receipt email sent");
            } catch (emailError) {
              console.error("Failed to send receipt email:", emailError);
            }
          }

          console.log("Payment recorded successfully");
        }
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "cash-payment") {
      // Verify authentication
      const { user, error: authError } = await verifyAuth(req, supabaseAdmin);
      if (authError) {
        return new Response(
          JSON.stringify({ error: authError }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify admin/staff role for cash payments
      const isAdmin = await verifyAdminRole(supabaseAdmin, user.id);
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ error: "Admin access required to record cash payments" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { customerId, deliveryId, amount, handledBy } = data;

      // Validate input
      if (!customerId || typeof amount !== 'number' || amount <= 0) {
        return new Response(
          JSON.stringify({ error: "Invalid payment data" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("Recording cash payment:", { customerId, amount, handledBy: user.id });

      // Get customer details first
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
          handled_by: user.id, // Use authenticated user, not client-provided
          reference: `CASH-${Date.now()}`,
        })
        .select()
        .single();

      if (paymentError) {
        console.error("Cash payment error:", paymentError);
        return new Response(
          JSON.stringify({ error: "Failed to record payment" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Update customer arrears (allow negative for credits/overpayments)
      const newArrears = (customer.arrears_balance || 0) - amount;
      await supabaseAdmin
        .from("customers")
        .update({ arrears_balance: newArrears })
        .eq("id", customerId);

      // Send receipt email if customer has email
      if (customer.email && payment) {
        try {
          const supabaseUrl = Deno.env.get("SUPABASE_URL");
          const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

          await fetch(`${supabaseUrl}/functions/v1/send-receipt-email`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${anonKey}`,
            },
            body: JSON.stringify({
              paymentId: payment.id,
              customerEmail: customer.email,
              customerName: customer.in_charge_name,
              amount: amount,
              method: "cash",
              transactionId: payment.reference,
              paidAt: payment.paid_at,
            }),
          });
          console.log("Receipt email sent for cash payment");
        } catch (emailError) {
          console.error("Failed to send receipt email:", emailError);
        }
      }

      return new Response(
        JSON.stringify({ success: true, payment, newArrears }),
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
