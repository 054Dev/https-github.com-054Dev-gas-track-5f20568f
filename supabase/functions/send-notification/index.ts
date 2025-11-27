import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  customerId: string;
  message: string;
  type: string;
  status: string;
}

const sendSMS = async (phoneNumber: string, message: string) => {
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  const twilioPhone = Deno.env.get("TWILIO_PHONE_NUMBER");

  console.log("Sending SMS to:", phoneNumber);

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
      },
      body: new URLSearchParams({
        To: phoneNumber,
        From: twilioPhone!,
        Body: message,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error("Twilio SMS error:", error);
    throw new Error(`Failed to send SMS: ${error}`);
  }

  return await response.json();
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { customerId, message, type, status }: NotificationRequest =
      await req.json();

    console.log("Sending notification for customer:", customerId);

    // Get customer details
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("email, phone, shop_name")
      .eq("id", customerId)
      .single();

    if (customerError || !customer) {
      throw new Error("Customer not found");
    }

    console.log("Customer found:", customer.shop_name);

    // Send email notification
    if (customer.email) {
      console.log("Sending email to:", customer.email);
      await resend.emails.send({
        from: "Gas Delivery <onboarding@resend.dev>",
        to: [customer.email],
        subject: `Order Status Update - ${status}`,
        html: `
          <h2>Hello ${customer.shop_name}!</h2>
          <p>${message}</p>
          <p>Current Status: <strong>${status.replace("_", " ").toUpperCase()}</strong></p>
          <p>Thank you for your business!</p>
        `,
      });
      console.log("Email sent successfully");
    }

    // Send SMS notification
    if (customer.phone) {
      console.log("Sending SMS to:", customer.phone);
      await sendSMS(customer.phone, `${customer.shop_name}: ${message}`);
      console.log("SMS sent successfully");
    }

    // Create notification record
    const { error: notificationError } = await supabase
      .from("notifications")
      .insert({
        customer_id: customerId,
        message,
        type,
        status: "sent",
        sent_at: new Date().toISOString(),
      });

    if (notificationError) {
      console.error("Error creating notification record:", notificationError);
      throw notificationError;
    }

    console.log("Notification record created");

    return new Response(
      JSON.stringify({ success: true, message: "Notifications sent" }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-notification function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
