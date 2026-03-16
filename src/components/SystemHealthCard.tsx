import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { Activity, Database, AlertTriangle, Clock } from "lucide-react";

interface HealthData {
  lastBackup: string | null;
  unresolvedErrors: number;
  tableCounts: { name: string; count: number }[];
}

export function SystemHealthCard() {
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHealth();
  }, []);

  const loadHealth = async () => {
    try {
      const [snapshotRes, errorsRes, customersRes, deliveriesRes, paymentsRes] = await Promise.all([
        supabase.from("dev_db_snapshots").select("created_at").order("created_at", { ascending: false }).limit(1),
        supabase.from("error_logs").select("*", { count: "exact", head: true }).eq("resolved", false),
        supabase.from("customers").select("*", { count: "exact", head: true }).is("deleted_at", null),
        supabase.from("deliveries").select("*", { count: "exact", head: true }),
        supabase.from("payments").select("*", { count: "exact", head: true }),
      ]);

      setData({
        lastBackup: snapshotRes.data?.[0]?.created_at ?? null,
        unresolvedErrors: errorsRes.count ?? 0,
        tableCounts: [
          { name: "Customers", count: customersRes.count ?? 0 },
          { name: "Deliveries", count: deliveriesRes.count ?? 0 },
          { name: "Payments", count: paymentsRes.count ?? 0 },
        ],
      });
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffH = Math.round((now.getTime() - d.getTime()) / 3600000);
    if (diffH < 1) return "Less than an hour ago";
    if (diffH < 24) return `${diffH}h ago`;
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  };

  if (loading) {
    return (
      <Card>
        <CardHeader><Skeleton className="h-5 w-32" /></CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const backupStale = !data.lastBackup || (Date.now() - new Date(data.lastBackup).getTime()) > 48 * 3600000;

  return (
    <Card className="col-span-full lg:col-span-2">
      <CardHeader className="flex flex-row items-center gap-2 pb-3">
        <Activity className="h-5 w-5 text-primary" />
        <CardTitle className="text-base">System Health</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-3">
          {/* Last Backup */}
          <div className="flex items-start gap-3 rounded-lg border p-3">
            <Clock className="mt-0.5 h-4 w-4 text-muted-foreground shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Last Backup</p>
              <p className="text-sm font-medium">
                {data.lastBackup ? formatDate(data.lastBackup) : "Never"}
              </p>
              {backupStale && (
                <Badge variant="destructive" className="mt-1 text-[10px] px-1.5 py-0">
                  Stale
                </Badge>
              )}
            </div>
          </div>

          {/* Unresolved Errors */}
          <div className="flex items-start gap-3 rounded-lg border p-3">
            <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${data.unresolvedErrors > 0 ? "text-destructive" : "text-muted-foreground"}`} />
            <div>
              <p className="text-xs text-muted-foreground">Unresolved Errors</p>
              <p className="text-sm font-medium">{data.unresolvedErrors}</p>
              {data.unresolvedErrors === 0 && (
                <Badge variant="secondary" className="mt-1 text-[10px] px-1.5 py-0">
                  All clear
                </Badge>
              )}
            </div>
          </div>

          {/* Table Row Counts */}
          <div className="flex items-start gap-3 rounded-lg border p-3">
            <Database className="mt-0.5 h-4 w-4 text-muted-foreground shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Table Rows</p>
              {data.tableCounts.map((t) => (
                <p key={t.name} className="text-sm">
                  <span className="text-muted-foreground">{t.name}:</span>{" "}
                  <span className="font-medium">{t.count.toLocaleString()}</span>
                </p>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
