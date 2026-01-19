import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper function to verify authentication and get user
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

// Helper function to verify admin role
async function verifyAdminRole(supabaseAdmin: any, userId: string, allowedRoles: string[] = ['admin', 'co_admin']): Promise<boolean> {
  const { data: roleData } = await supabaseAdmin
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .in('role', allowedRoles)
    .maybeSingle();

  return !!roleData;
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

    // Verify authentication
    const { user, error: authError } = await verifyAuth(req, supabaseAdmin);
    if (authError) {
      return new Response(
        JSON.stringify({ error: authError }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { action, ...data } = await req.json();

    if (action === "get-user-email") {
      // Verify admin/co_admin role
      const isAdmin = await verifyAdminRole(supabaseAdmin, user.id);
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ error: "Admin access required" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { userId } = data;
      if (!userId) {
        return new Response(
          JSON.stringify({ error: "User ID required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: authUser, error } = await supabaseAdmin.auth.admin.getUserById(userId);
      
      if (error) {
        console.error("Error fetching user:", error);
        return new Response(
          JSON.stringify({ error: "Failed to fetch user" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ email: authUser?.user?.email || null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "delete-user") {
      // Only admin can delete users
      const isAdmin = await verifyAdminRole(supabaseAdmin, user.id, ['admin']);
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ error: "Admin access required" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { userId } = data;
      if (!userId) {
        return new Response(
          JSON.stringify({ error: "User ID required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Prevent self-deletion through this endpoint
      if (userId === user.id) {
        return new Response(
          JSON.stringify({ error: "Cannot delete your own account through this endpoint" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);

      if (error) {
        console.error("Error deleting user:", error);
        return new Response(
          JSON.stringify({ error: "Failed to delete user" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Best-effort cleanup of public tables (prevents "ghost" accounts/data)
      try {
        await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
        await supabaseAdmin.from("customers").delete().eq("user_id", userId);
        await supabaseAdmin.from("profiles").delete().eq("id", userId);
        await supabaseAdmin.from("deletion_requests").delete().eq("user_id", userId);
      } catch (cleanupError) {
        console.error("Cleanup error after user deletion:", cleanupError);
      }

      console.log("User deleted successfully:", userId);

      return new Response(
        JSON.stringify({ success: true }),
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
