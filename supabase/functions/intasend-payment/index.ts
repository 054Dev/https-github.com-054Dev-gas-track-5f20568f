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
          method: paymentMethod.toUpperCase(), // MPESA, AIRTEL-MONEY, BANK-TRANSFER, CARD
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

          const { error: paymentError } = await supabaseAdmin
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
            });

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
      const { data: customer } = await supabaseAdmin
        .from("customers")
        .select("arrears_balance")
        .eq("id", customerId)
        .single();

      if (customer) {
        const newArrears = Math.max(0, (customer.arrears_balance || 0) - amount);
        await supabaseAdmin
          .from("customers")
          .update({ arrears_balance: newArrears })
          .eq("id", customerId);
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
