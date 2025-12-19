import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
      // Initialize Intasend payment
      const { customerId, amount, deliveryId, paymentMethod } = data;

      console.log("Initializing payment:", { customerId, amount, deliveryId, paymentMethod });

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
        throw new Error("Customer not found");
      }

      // Map frontend payment methods to Intasend API method values
      const methodMap: Record<string, string> = {
        "mpesa": "M-PESA",
        "airtel-money": "M-PESA", // Airtel Money uses same mobile money method
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
        throw new Error(`Intasend API error: ${error}`);
      }

      const paymentData = await intasendResponse.json();
      console.log("Payment initialized:", paymentData);

      return new Response(
        JSON.stringify({ success: true, data: paymentData }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "webhook") {
      // Handle Intasend webhook
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

          // Update customer arrears
          const newArrears = Math.max(0, (delivery.customers.arrears_balance || 0) - parseFloat(amount));
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
      // Record manual cash payment (admin only)
      const { customerId, deliveryId, amount, handledBy } = data;

      // Get customer details first
      const { data: customer } = await supabaseAdmin
        .from("customers")
        .select("email, in_charge_name, arrears_balance")
        .eq("id", customerId)
        .single();

      const { data: payment, error: paymentError } = await supabaseAdmin
        .from("payments")
        .insert({
          customer_id: customerId,
          delivery_id: deliveryId,
          amount_paid: amount,
          method: "cash",
          payment_provider: "manual",
          payment_status: "completed",
          handled_by: handledBy,
          reference: `CASH-${Date.now()}`,
        })
        .select()
        .single();

      if (paymentError) {
        console.error("Cash payment error:", paymentError);
        throw paymentError;
      }

      // Update customer arrears
      if (customer) {
        const newArrears = Math.max(0, (customer.arrears_balance || 0) - amount);
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
      }

      return new Response(
        JSON.stringify({ success: true, payment }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw new Error("Invalid action");
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
