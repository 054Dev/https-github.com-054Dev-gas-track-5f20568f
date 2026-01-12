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

// Verify authentication from Authorization header
async function verifyAuth(req: Request, supabaseAdmin: any): Promise<{ user: any; error?: string }> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return { user: null, error: 'Missing authorization header' };
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  
  if (error || !user) {
    return { user: null, error: 'Invalid or expired token' };
  }

  return { user };
}

// Verify user has admin/staff role
async function verifyAdminRole(supabaseAdmin: any, userId: string): Promise<boolean> {
  const { data: roleData } = await supabaseAdmin
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .in('role', ['admin', 'co_admin', 'staff'])
    .maybeSingle();

  return !!roleData;
}

const sendSMS = async (phoneNumber: string, message: string) => {
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  const twilioPhone = Deno.env.get("TWILIO_PHONE_NUMBER");

  console.log("Sending SMS");

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
    console.error("Twilio SMS error");
    throw new Error(`Failed to send SMS`);
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

    // Verify authentication
    const { user, error: authError } = await verifyAuth(req, supabase);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: authError || 'Unauthorized' }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Verify admin/staff role
    const isAdmin = await verifyAdminRole(supabase, user.id);
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Insufficient permissions' }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { customerId, message, type, status }: NotificationRequest =
      await req.json();

    // Validate required fields
    if (!customerId || !message || !type || !status) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Sending notification for customer");

    // Get customer details
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("email, phone, shop_name")
      .eq("id", customerId)
      .single();

    if (customerError || !customer) {
      return new Response(
        JSON.stringify({ error: "Customer not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Customer found");

    // Send email notification
    if (customer.email) {
      console.log("Sending email");
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
      console.log("Sending SMS");
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
      console.error("Error creating notification record");
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
    console.error("Error in send-notification function");
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
