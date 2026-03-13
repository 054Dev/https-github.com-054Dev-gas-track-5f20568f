import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, pin, ...params } = await req.json();

    // Verify PIN for all actions
    const devPin = Deno.env.get("DEV_PIN");
    if (!devPin || pin !== devPin) {
      return new Response(JSON.stringify({ error: "Invalid PIN" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    switch (action) {
      case "verify_pin": {
        return new Response(JSON.stringify({ valid: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "get_tables": {
        const { data, error } = await supabaseAdmin.rpc("get_table_list").maybeSingle();
        // Fallback: list known tables
        const tables = [
          "customers", "deliveries", "delivery_items", "payments",
          "receipts", "notifications", "services", "cylinder_capacities",
          "profiles", "user_roles", "admin_otps", "deletion_requests",
          "receipt_template_settings", "error_logs", "dev_db_snapshots"
        ];
        return new Response(JSON.stringify({ tables }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "clear_table": {
        const { table_name } = params;
        const safeTables = [
          "customers", "deliveries", "delivery_items", "payments",
          "receipts", "notifications", "services", "cylinder_capacities",
          "profiles", "user_roles", "admin_otps", "deletion_requests",
          "receipt_template_settings", "error_logs", "dev_db_snapshots"
        ];
        if (!safeTables.includes(table_name)) {
          return new Response(JSON.stringify({ error: "Invalid table name" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { error } = await supabaseAdmin.from(table_name).delete().neq("id", "00000000-0000-0000-0000-000000000000");
        if (error) throw error;
        return new Response(JSON.stringify({ success: true, message: `Table ${table_name} cleared` }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "clear_all": {
        const orderedTables = [
          "error_logs", "dev_db_snapshots", "receipts", "notifications",
          "delivery_items", "payments", "deliveries", "deletion_requests",
          "admin_otps", "customers", "services", "cylinder_capacities",
          "receipt_template_settings", "profiles", "user_roles"
        ];
        const results: string[] = [];
        for (const table of orderedTables) {
          try {
            await supabaseAdmin.from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000");
            results.push(`${table}: cleared`);
          } catch (e: any) {
            results.push(`${table}: ${e.message}`);
          }
        }
        return new Response(JSON.stringify({ success: true, results }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "get_table_data": {
        const { table_name, limit: rowLimit = 100 } = params;
        const { data, error } = await supabaseAdmin
          .from(table_name)
          .select("*")
          .limit(rowLimit)
          .order("created_at", { ascending: false });
        if (error) throw error;
        return new Response(JSON.stringify({ data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "create_backup": {
        const { label } = params;
        const tables = [
          "customers", "deliveries", "delivery_items", "payments",
          "receipts", "notifications", "services", "cylinder_capacities",
          "profiles", "user_roles", "admin_otps", "receipt_template_settings"
        ];
        const backup: Record<string, any[]> = {};
        for (const table of tables) {
          const { data } = await supabaseAdmin.from(table).select("*");
          backup[table] = data || [];
        }
        const { error } = await supabaseAdmin.from("dev_db_snapshots").insert({
          data: backup,
          label: label || `Backup ${new Date().toISOString()}`,
        });
        if (error) throw error;
        return new Response(JSON.stringify({ success: true, message: "Backup created" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "list_backups": {
        const { data, error } = await supabaseAdmin
          .from("dev_db_snapshots")
          .select("id, label, created_at")
          .order("created_at", { ascending: false });
        if (error) throw error;
        return new Response(JSON.stringify({ data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "restore_backup": {
        const { backup_id } = params;
        const { data: snapshot, error: fetchError } = await supabaseAdmin
          .from("dev_db_snapshots")
          .select("data")
          .eq("id", backup_id)
          .single();
        if (fetchError || !snapshot) throw new Error("Backup not found");

        const backupData = snapshot.data as Record<string, any[]>;
        // Clear tables in order then restore
        const clearOrder = [
          "receipts", "notifications", "delivery_items", "payments",
          "deliveries", "admin_otps", "customers", "services",
          "cylinder_capacities", "receipt_template_settings", "profiles", "user_roles"
        ];
        for (const table of clearOrder) {
          await supabaseAdmin.from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000");
        }
        // Restore in reverse order
        const restoreOrder = [...clearOrder].reverse();
        const results: string[] = [];
        for (const table of restoreOrder) {
          if (backupData[table] && backupData[table].length > 0) {
            const { error } = await supabaseAdmin.from(table).insert(backupData[table]);
            results.push(`${table}: ${error ? error.message : `${backupData[table].length} rows restored`}`);
          }
        }
        return new Response(JSON.stringify({ success: true, results }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "delete_backup": {
        const { backup_id } = params;
        const { error } = await supabaseAdmin
          .from("dev_db_snapshots")
          .delete()
          .eq("id", backup_id);
        if (error) throw error;
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
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
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
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
        return new Response(JSON.stringify({ data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
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
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "clear_error_logs": {
        const { error } = await supabaseAdmin
          .from("error_logs")
          .delete()
          .neq("id", "00000000-0000-0000-0000-000000000000");
        if (error) throw error;
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
