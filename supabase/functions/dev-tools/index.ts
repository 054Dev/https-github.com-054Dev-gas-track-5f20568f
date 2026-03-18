import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BACKUP_TABLES = [
  "customers", "deliveries", "delivery_items", "payments",
  "receipts", "notifications", "services", "cylinder_capacities",
  "profiles", "user_roles", "admin_otps", "receipt_template_settings"
];

const SAFE_TABLES = [
  ...BACKUP_TABLES, "error_logs", "dev_db_snapshots", "deletion_requests"
];

// NEVER include dev_db_snapshots here — backups must survive clears
const CLEAR_ORDER = [
  "error_logs", "receipts", "notifications",
  "delivery_items", "payments", "deliveries", "deletion_requests",
  "admin_otps", "customers", "services", "cylinder_capacities",
  "receipt_template_settings", "profiles", "user_roles"
];

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

// Create a backup snapshot
async function createBackupSnapshot(supabaseAdmin: any, label: string, createdBy?: string) {
  const backup: Record<string, any[]> = {};
  for (const table of BACKUP_TABLES) {
    const { data } = await supabaseAdmin.from(table).select("*");
    backup[table] = data || [];
  }
  const { error } = await supabaseAdmin.from("dev_db_snapshots").insert({
    data: backup,
    label,
    created_by: createdBy || null,
  });
  if (error) throw error;
  return backup;
}

// Verify admin role via JWT
async function verifyAdminJWT(req: Request, supabaseAdmin: any): Promise<string | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await supabaseAdmin.auth.getClaims(token);
  if (error || !data?.claims?.sub) return null;
  const userId = data.claims.sub;
  const { data: roleData } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["admin", "co_admin"])
    .maybeSingle();
  return roleData ? userId : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, pin, ...params } = body;
    const supabaseAdmin = getSupabaseAdmin();

    // Determine auth: PIN or admin JWT
    const ADMIN_BACKUP_ACTIONS = [
      "list_backups", "create_backup", "restore_backup", "delete_backup",
      "check_system_initialized"
    ];

    let authenticated = false;
    let authUserId: string | null = null;

    if (pin) {
      const devPin = Deno.env.get("DEV_PIN");
      if (devPin && pin === devPin) authenticated = true;
    }

    // For backup actions, also allow admin JWT auth
    if (!authenticated && ADMIN_BACKUP_ACTIONS.includes(action)) {
      authUserId = await verifyAdminJWT(req, supabaseAdmin);
      if (authUserId) authenticated = true;
    }

    // Daily backup action uses service key (called from cron)
    if (action === "daily_backup") {
      const cronSecret = req.headers.get("x-cron-secret");
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      // Accept if called with valid authorization
      if (cronSecret === serviceKey || cronSecret === anonKey) {
        authenticated = true;
      }
      // Also accept PIN auth
    }

    if (!authenticated) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const jsonResponse = (data: any, status = 200) =>
      new Response(JSON.stringify(data), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    switch (action) {
      case "verify_pin": {
        return jsonResponse({ valid: true });
      }

      case "check_system_initialized": {
        // Check if admin role exists
        const { data: adminRole } = await supabaseAdmin
          .from("user_roles")
          .select("id")
          .eq("role", "admin")
          .maybeSingle();
        const { data: backups } = await supabaseAdmin
          .from("dev_db_snapshots")
          .select("id, label, created_at")
          .order("created_at", { ascending: false })
          .limit(5);
        return jsonResponse({
          initialized: !!adminRole,
          hasBackups: (backups?.length || 0) > 0,
          recentBackups: backups || [],
        });
      }

      case "get_tables": {
        return jsonResponse({ tables: SAFE_TABLES });
      }

      case "clear_table": {
        const { table_name } = params;
        if (!SAFE_TABLES.includes(table_name)) {
          return jsonResponse({ error: "Invalid table name" }, 400);
        }
        // Auto-backup before destructive action
        await createBackupSnapshot(
          supabaseAdmin,
          `Auto-backup before clearing ${table_name} — ${new Date().toISOString()}`
        );
        const { error } = await supabaseAdmin.from(table_name).delete().neq("id", "00000000-0000-0000-0000-000000000000");
        if (error) throw error;
        return jsonResponse({ success: true, message: `Table ${table_name} cleared (auto-backup created)` });
      }

      case "clear_all": {
        // Auto-backup before full clear
        await createBackupSnapshot(
          supabaseAdmin,
          `Auto-backup before full database clear — ${new Date().toISOString()}`
        );
        const results: string[] = [];
        for (const table of CLEAR_ORDER) {
          try {
            await supabaseAdmin.from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000");
            results.push(`${table}: cleared`);
          } catch (e: any) {
            results.push(`${table}: ${e.message}`);
          }
        }
        return jsonResponse({ success: true, results, autoBackupCreated: true });
      }

      case "get_table_data": {
        const { table_name, limit: rowLimit = 100 } = params;
        const { data, error } = await supabaseAdmin
          .from(table_name)
          .select("*")
          .limit(rowLimit)
          .order("created_at", { ascending: false });
        if (error) throw error;
        return jsonResponse({ data });
      }

      case "create_backup": {
        const { label } = params;
        await createBackupSnapshot(
          supabaseAdmin,
          label || `Manual backup — ${new Date().toISOString()}`,
          authUserId || undefined
        );
        return jsonResponse({ success: true, message: "Backup created" });
      }

      case "daily_backup": {
        // Cleanup: keep only last 7 daily auto-backups
        const { data: oldBackups } = await supabaseAdmin
          .from("dev_db_snapshots")
          .select("id, label")
          .like("label", "Daily auto-backup%")
          .order("created_at", { ascending: false });
        if (oldBackups && oldBackups.length >= 7) {
          const toDelete = oldBackups.slice(7).map((b: any) => b.id);
          if (toDelete.length > 0) {
            await supabaseAdmin.from("dev_db_snapshots").delete().in("id", toDelete);
          }
        }
        await createBackupSnapshot(
          supabaseAdmin,
          `Daily auto-backup — ${new Date().toISOString()}`
        );
        return jsonResponse({ success: true, message: "Daily backup created" });
      }

      case "list_backups": {
        const { data, error } = await supabaseAdmin
          .from("dev_db_snapshots")
          .select("id, label, created_at, created_by")
          .order("created_at", { ascending: false });
        if (error) throw error;
        return jsonResponse({ data });
      }

      case "restore_backup": {
        const { backup_id } = params;
        const { data: snapshot, error: fetchError } = await supabaseAdmin
          .from("dev_db_snapshots")
          .select("data")
          .eq("id", backup_id)
          .single();
        if (fetchError || !snapshot) throw new Error("Backup not found");

        // Auto-backup before restore
        await createBackupSnapshot(
          supabaseAdmin,
          `Auto-backup before restore — ${new Date().toISOString()}`
        );

        const backupData = snapshot.data as Record<string, any[]>;
        const clearOrder = [
          "receipts", "notifications", "delivery_items", "payments",
          "deliveries", "admin_otps", "deletion_requests", "customers", "services",
          "cylinder_capacities", "receipt_template_settings", "profiles", "user_roles"
        ];
        for (const table of clearOrder) {
          await supabaseAdmin.from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000");
        }
        const restoreOrder = [...clearOrder].reverse();
        const results: string[] = [];
        for (const table of restoreOrder) {
          if (backupData[table] && backupData[table].length > 0) {
            const { error } = await supabaseAdmin.from(table).insert(backupData[table]);
            results.push(`${table}: ${error ? error.message : `${backupData[table].length} rows restored`}`);
          }
        }
        return jsonResponse({ success: true, results });
      }

      case "delete_backup": {
        const { backup_id } = params;
        const { error } = await supabaseAdmin
          .from("dev_db_snapshots")
          .delete()
          .eq("id", backup_id);
        if (error) throw error;
        return jsonResponse({ success: true });
      }

      case "log_error": {
        const { type, message, stack_trace, metadata, source } = params;
        const { error } = await supabaseAdmin.from("error_logs").insert({
          type: type || "client",
          message,
          stack_trace,
          metadata,
          source,
        });
        if (error) throw error;
        return jsonResponse({ success: true });
      }

      case "get_error_logs": {
        const { type_filter, resolved_filter, limit: logLimit = 100 } = params;
        let query = supabaseAdmin
          .from("error_logs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(logLimit);
        if (type_filter && type_filter !== "all") {
          query = query.eq("type", type_filter);
        }
        if (resolved_filter !== undefined && resolved_filter !== "all") {
          query = query.eq("resolved", resolved_filter === "resolved");
        }
        const { data, error } = await query;
        if (error) throw error;
        return jsonResponse({ data });
      }

      case "resolve_error": {
        const { error_id, resolution_notes } = params;
        const { error } = await supabaseAdmin
          .from("error_logs")
          .update({
            resolved: true,
            resolution_notes,
            resolved_at: new Date().toISOString(),
          })
          .eq("id", error_id);
        if (error) throw error;
        return jsonResponse({ success: true });
      }

      case "clear_error_logs": {
        const { error } = await supabaseAdmin
          .from("error_logs")
          .delete()
          .neq("id", "00000000-0000-0000-0000-000000000000");
        if (error) throw error;
        return jsonResponse({ success: true });
      }

      default:
        return jsonResponse({ error: "Unknown action" }, 400);
    }
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
