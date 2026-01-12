import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface VerifyOTPRequest {
  email: string;
  otp: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { email, otp }: VerifyOTPRequest = await req.json();

    // Validate required fields
    if (!email || !otp) {
      return new Response(
        JSON.stringify({ error: 'Email and OTP are required', valid: false }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Validate OTP format (should be 6 digits)
    if (!/^\d{6}$/.test(otp)) {
      return new Response(
        JSON.stringify({ error: 'Invalid OTP format', valid: false }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email format', valid: false }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Verifying OTP for email");

    // Query admin_otps table for matching OTP (using service role to bypass RLS)
    const { data: otpRecord, error: queryError } = await supabase
      .from("admin_otps")
      .select("id, expires_at, used")
      .eq("email", email.toLowerCase().trim())
      .eq("otp", otp)
      .eq("used", false)
      .maybeSingle();

    if (queryError) {
      console.error("Error querying OTP");
      return new Response(
        JSON.stringify({ error: 'Verification failed', valid: false }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!otpRecord) {
      console.log("No matching OTP found");
      return new Response(
        JSON.stringify({ error: 'Invalid or expired OTP', valid: false }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check if OTP has expired
    const expiresAt = new Date(otpRecord.expires_at);
    if (expiresAt < new Date()) {
      console.log("OTP has expired");
      return new Response(
        JSON.stringify({ error: 'OTP has expired', valid: false }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Mark OTP as used
    const { error: updateError } = await supabase
      .from("admin_otps")
      .update({ used: true })
      .eq("id", otpRecord.id);

    if (updateError) {
      console.error("Error marking OTP as used");
      // Still return valid since the OTP was correct
    }

    console.log("OTP verified successfully");

    return new Response(
      JSON.stringify({ valid: true, message: "OTP verified successfully" }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in verify-otp function");
    return new Response(
      JSON.stringify({ error: "Internal server error", valid: false }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
