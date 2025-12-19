import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReceiptEmailRequest {
  paymentId: string;
  customerEmail: string;
  customerName: string;
  amount: number;
  method: string;
  transactionId?: string;
  paidAt: string;
}

const getMethodDisplay = (method: string): string => {
  const methods: Record<string, string> = {
    "mpesa": "M-Pesa",
    "airtel-money": "Airtel Money",
    "cash": "Cash",
    "equity-bank": "Equity Bank",
    "family-bank": "Family Bank",
    "kcb": "KCB Bank",
    "cooperative-bank": "Cooperative Bank",
    "paypal": "PayPal",
  };
  return methods[method] || method.charAt(0).toUpperCase() + method.slice(1);
};

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const handler = async (req: Request): Promise<Response> => {
  console.log("send-receipt-email function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { 
      paymentId, 
      customerEmail, 
      customerName, 
      amount, 
      method, 
      transactionId,
      paidAt 
    }: ReceiptEmailRequest = await req.json();

    console.log("Sending receipt email to:", customerEmail);

    if (!customerEmail) {
      console.log("No customer email provided, skipping email send");
      return new Response(JSON.stringify({ success: false, error: "No email provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Fetch template settings
    const { data: templateData } = await supabaseClient
      .from("receipt_template_settings")
      .select("*")
      .single();

    const companyName = templateData?.company_name || "FINE GAS LIMITED";
    const footerText = templateData?.footer_text || "Thank you for your payment!";
    const logoUrl = templateData?.logo_url || "";

    // Build custom fields HTML
    let customFieldsHtml = "";
    if (templateData) {
      const customFields = [
        { label: templateData.custom_field_1_label, value: templateData.custom_field_1_value },
        { label: templateData.custom_field_2_label, value: templateData.custom_field_2_value },
        { label: templateData.custom_field_3_label, value: templateData.custom_field_3_value },
      ].filter(f => f.label && f.value);

      if (customFields.length > 0) {
        customFieldsHtml = customFields.map(f => `
          <tr>
            <td style="padding: 8px 0; color: #666; font-size: 14px;">${f.label}</td>
            <td style="padding: 8px 0; text-align: right; font-weight: 600;">${f.value}</td>
          </tr>
        `).join("");
      }
    }

    const logoHtml = logoUrl 
      ? `<img src="${logoUrl}" alt="${companyName}" style="max-height: 60px; margin-bottom: 16px;" />`
      : "";

    const transactionIdHtml = (templateData?.show_transaction_id !== false && transactionId) 
      ? `<tr>
          <td style="padding: 8px 0; color: #666; font-size: 14px;">Transaction ID</td>
          <td style="padding: 8px 0; text-align: right; font-family: monospace; font-size: 12px; word-break: break-all;">${transactionId}</td>
        </tr>`
      : "";

    const paymentMethodHtml = templateData?.show_payment_method !== false
      ? `<tr>
          <td style="padding: 8px 0; color: #666; font-size: 14px;">Payment Method</td>
          <td style="padding: 8px 0; text-align: right; font-weight: 600;">${getMethodDisplay(method)}</td>
        </tr>`
      : "";

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; background: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 32px 24px; text-align: center; border-bottom: 2px solid #e5e5e5;">
              ${logoHtml}
              <h1 style="margin: 0 0 8px; font-size: 24px; font-weight: 700; color: #1a1a1a;">${companyName}</h1>
              <p style="margin: 0; color: #666; font-size: 14px;">Payment Receipt</p>
            </td>
          </tr>
          
          <!-- Customer Info -->
          <tr>
            <td style="padding: 24px 32px;">
              <table role="presentation" style="width: 100%;">
                <tr>
                  <td>
                    <p style="margin: 0 0 4px; color: #666; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Customer Name</p>
                    <p style="margin: 0; font-size: 18px; font-weight: 600; color: #1a1a1a;">${customerName}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding-top: 16px;">
                    <p style="margin: 0 0 4px; color: #666; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Date & Time</p>
                    <p style="margin: 0; font-size: 14px; font-weight: 500; color: #1a1a1a;">${formatDate(paidAt)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Transaction Details -->
          <tr>
            <td style="padding: 0 32px 24px;">
              <table role="presentation" style="width: 100%; border-top: 1px solid #e5e5e5; border-bottom: 1px solid #e5e5e5;">
                ${paymentMethodHtml}
                <tr>
                  <td style="padding: 8px 0; color: #666; font-size: 14px;">Status</td>
                  <td style="padding: 8px 0; text-align: right;">
                    <span style="display: inline-block; padding: 4px 12px; background: #22c55e; color: white; font-size: 12px; font-weight: 600; border-radius: 12px;">Completed</span>
                  </td>
                </tr>
                ${transactionIdHtml}
                ${customFieldsHtml}
              </table>
            </td>
          </tr>
          
          <!-- Amount -->
          <tr>
            <td style="padding: 0 32px 32px;">
              <table role="presentation" style="width: 100%; background: #f0f9ff; border-radius: 8px; padding: 20px;">
                <tr>
                  <td style="padding: 20px;">
                    <table role="presentation" style="width: 100%;">
                      <tr>
                        <td style="color: #666; font-size: 14px; font-weight: 600;">Total Amount Paid</td>
                        <td style="text-align: right;">
                          <span style="font-size: 28px; font-weight: 700; color: #2563eb;">KES ${amount.toLocaleString()}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; text-align: center; border-top: 2px solid #e5e5e5; background: #fafafa; border-radius: 0 0 12px 12px;">
              <p style="margin: 0 0 8px; color: #666; font-size: 14px; white-space: pre-line;">${footerText}</p>
              <p style="margin: 0; color: #999; font-size: 12px;">This is an official receipt from ${companyName}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    // Send email using Resend API directly
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `${companyName} <onboarding@resend.dev>`,
        to: [customerEmail],
        subject: `Payment Receipt - KES ${amount.toLocaleString()}`,
        html: emailHtml,
      }),
    });

    const emailResponse = await res.json();

    if (!res.ok) {
      console.error("Resend API error:", emailResponse);
      throw new Error(emailResponse.message || "Failed to send email");
    }

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, data: emailResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending receipt email:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
