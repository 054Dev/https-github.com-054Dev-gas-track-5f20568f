import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { setDevPin, flushErrorQueue } from "@/lib/error-logger";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Database, Trash2, Download, Upload, RefreshCw, Shield,
  AlertTriangle, CheckCircle, Bug, Clock, Search, X, Eye
} from "lucide-react";
import logo from "@/assets/logo.png";
import { SystemHealthCard } from "@/components/SystemHealthCard";

const TABLES = [
  "customers", "deliveries", "delivery_items", "payments",
  "receipts", "notifications", "services", "cylinder_capacities",
  "profiles", "user_roles", "admin_otps", "deletion_requests",
  "receipt_template_settings", "error_logs", "dev_db_snapshots"
];

export default function Setup() {
  const [authenticated, setAuthenticated] = useState(false);
  const [pin, setPin] = useState("");
  const [storedPin, setStoredPin] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const verifyPin = async () => {
    if (pin.length !== 6) {
      toast({ title: "Invalid PIN", description: "Enter a 6-digit PIN", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("dev-tools", {
        body: { action: "verify_pin", pin },
      });
      if (error || !data?.valid) throw new Error("Invalid PIN");
      setStoredPin(pin);
      setDevPin(pin);
      sessionStorage.setItem("dev_pin", pin);
      setAuthenticated(true);
      flushErrorQueue();
      toast({ title: "Access Granted", description: "Welcome, developer." });
    } catch {
      toast({ title: "Access Denied", description: "Invalid PIN.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <img src={logo} alt="Fine Gas Limited" className="h-20 mx-auto mb-3" />
            <CardTitle className="flex items-center justify-center gap-2">
              <Shield className="h-5 w-5" /> Developer Access
            </CardTitle>
            <CardDescription>Enter your 6-digit developer PIN</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              type="password"
              maxLength={6}
              placeholder="••••••"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && verifyPin()}
              className="text-center text-2xl tracking-[0.5em] font-mono"
            />
            <Button onClick={verifyPin} disabled={loading || pin.length !== 6} className="w-full">
              {loading ? "Verifying..." : "Access Dev Tools"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <DevDashboard pin={storedPin} />;
}

function DevDashboard({ pin }: { pin: string }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/95 backdrop-blur sticky top-0 z-50">
        <div className="container flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-bold text-primary">Dev Tools</h1>
            <Badge variant="outline" className="text-xs">Fine Gas Limited</Badge>
          </div>
          <Button variant="ghost" size="sm" onClick={() => {
            sessionStorage.removeItem("dev_pin");
            window.location.reload();
          }}>
            Lock <X className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </header>

      <div className="container px-4 py-6 space-y-6">
        <SystemHealthCard />
        <Tabs defaultValue="database" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="database" className="gap-1">
              <Database className="h-4 w-4" /> Database
            </TabsTrigger>
            <TabsTrigger value="errors" className="gap-1">
              <Bug className="h-4 w-4" /> Error Logs
            </TabsTrigger>
            <TabsTrigger value="backups" className="gap-1">
              <Download className="h-4 w-4" /> Backups
            </TabsTrigger>
          </TabsList>

          <TabsContent value="database">
            <DatabaseTools pin={pin} />
          </TabsContent>
          <TabsContent value="errors">
            <ErrorLogs pin={pin} />
          </TabsContent>
          <TabsContent value="backups">
            <BackupTools pin={pin} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// Clearable tables (never includes dev_db_snapshots)
const CLEARABLE_TABLES = [
  "error_logs", "receipts", "notifications",
  "delivery_items", "payments", "deliveries", "deletion_requests",
  "admin_otps", "customers", "services", "cylinder_capacities",
  "receipt_template_settings", "profiles", "user_roles"
];

function DatabaseTools({ pin }: { pin: string }) {
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [tableData, setTableData] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [selectedClearTables, setSelectedClearTables] = useState<string[]>([]);
  const [protectAdmin, setProtectAdmin] = useState(true);
  const [confirmText, setConfirmText] = useState("");
  const { toast } = useToast();

  const loadTableData = async (table: string) => {
    setLoadingData(true);
    try {
      const { data, error } = await supabase.functions.invoke("dev-tools", {
        body: { action: "get_table_data", pin, table_name: table, limit: 100 },
      });
      if (error) throw error;
      setTableData(data?.data || []);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoadingData(false);
    }
  };

  const clearTable = async (table: string) => {
    setClearing(true);
    try {
      const { data, error } = await supabase.functions.invoke("dev-tools", {
        body: { action: "clear_table", pin, table_name: table },
      });
      if (error) throw error;
      toast({ title: "Success", description: data?.message });
      if (selectedTable === table) loadTableData(table);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setClearing(false);
    }
  };

  const [showRecoveryHub, setShowRecoveryHub] = useState(false);
  const [recoveryBackups, setRecoveryBackups] = useState<any[]>([]);

  const openClearDialog = () => {
    setSelectedClearTables([]);
    setProtectAdmin(true);
    setConfirmText("");
    setShowClearDialog(true);
  };

  const toggleClearTable = (table: string) => {
    setSelectedClearTables(prev =>
      prev.includes(table) ? prev.filter(t => t !== table) : [...prev, table]
    );
  };

  const selectAllClearTables = () => {
    const adminTables = ["profiles", "user_roles"];
    if (selectedClearTables.length === CLEARABLE_TABLES.length) {
      setSelectedClearTables([]);
    } else {
      setSelectedClearTables(
        protectAdmin ? CLEARABLE_TABLES.filter(t => !adminTables.includes(t)) : [...CLEARABLE_TABLES]
      );
    }
  };

  const executeClear = async () => {
    if (confirmText !== "DELETE") return;
    setClearing(true);
    setShowClearDialog(false);
    try {
      const { data, error } = await supabase.functions.invoke("dev-tools", {
        body: {
          action: "clear_all",
          pin,
          tables: selectedClearTables.length > 0 ? selectedClearTables : undefined,
          protect_admin: protectAdmin,
        },
      });
      if (error) throw error;
      toast({ title: "Database Cleared", description: `${data?.results?.length} tables processed. Auto-backup was created.` });
      setTableData([]);
      setConfirmText("");
      // Load backups and show recovery hub
      const { data: backupData } = await supabase.functions.invoke("dev-tools", {
        body: { action: "list_backups", pin },
      });
      setRecoveryBackups(backupData?.data || []);
      setShowRecoveryHub(true);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setClearing(false);
    }
  };

  const restoreFromRecovery = async (backupId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("dev-tools", {
        body: { action: "restore_backup", pin, backup_id: backupId },
      });
      if (error) throw error;
      toast({ title: "Backup Restored", description: `${data?.results?.length} tables restored.` });
      setShowRecoveryHub(false);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const adminTables = ["profiles", "user_roles"];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <Select value={selectedTable} onValueChange={(v) => { setSelectedTable(v); loadTableData(v); }}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Select a table to view" />
          </SelectTrigger>
          <SelectContent>
            {TABLES.map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectedTable && (
          <>
            <Button variant="outline" size="sm" onClick={() => loadTableData(selectedTable)} disabled={loadingData}>
              <RefreshCw className={`h-4 w-4 mr-1 ${loadingData ? "animate-spin" : ""}`} /> Refresh
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" disabled={clearing}>
                  <Trash2 className="h-4 w-4 mr-1" /> Clear Table
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear {selectedTable}?</AlertDialogTitle>
                  <AlertDialogDescription>This will permanently delete all rows in this table. An auto-backup will be created first.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => clearTable(selectedTable)}>Delete All</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}

        <div className="ml-auto">
          <Button variant="destructive" disabled={clearing} onClick={openClearDialog}>
            <Trash2 className="h-4 w-4 mr-1" /> Selective Database Clear
          </Button>
        </div>
      </div>

      {/* Selective Clear Dialog */}
      <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <AlertDialogContent className="max-w-lg max-h-[85vh] overflow-auto">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Selective Database Clear
            </AlertDialogTitle>
            <AlertDialogDescription>
              Choose which tables to clear. Backups are <strong>never</strong> deleted. An auto-backup is always created before clearing.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4">
            {/* Admin protection toggle */}
            <div className="flex items-center gap-3 p-3 rounded-lg border-2 border-primary/30 bg-primary/5">
              <Shield className="h-5 w-5 text-primary shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold">Protect admin data</p>
                <p className="text-xs text-muted-foreground">Keep profiles & user_roles intact (your admin account)</p>
              </div>
              <Button
                variant={protectAdmin ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setProtectAdmin(!protectAdmin);
                  if (!protectAdmin) {
                    // Re-enabling protection: remove admin tables from selection
                    setSelectedClearTables(prev => prev.filter(t => !adminTables.includes(t)));
                  }
                }}
              >
                {protectAdmin ? "Protected ✓" : "Unprotected"}
              </Button>
            </div>

            {/* Table selection */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium">Select tables to clear:</p>
                <Button variant="ghost" size="sm" onClick={selectAllClearTables}>
                  {selectedClearTables.length === CLEARABLE_TABLES.length ? "Deselect All" : "Select All"}
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-1.5 max-h-60 overflow-auto">
                {CLEARABLE_TABLES.map((table) => {
                  const isAdmin = adminTables.includes(table);
                  const isDisabled = protectAdmin && isAdmin;
                  const isSelected = selectedClearTables.includes(table);
                  return (
                    <button
                      key={table}
                      onClick={() => !isDisabled && toggleClearTable(table)}
                      disabled={isDisabled}
                      className={`text-left text-xs p-2 rounded border transition-colors ${
                        isDisabled
                          ? "opacity-40 cursor-not-allowed border-muted bg-muted/30"
                          : isSelected
                          ? "border-destructive bg-destructive/10 text-destructive font-medium"
                          : "border-border hover:border-muted-foreground/30 hover:bg-muted/50"
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        <span className={`w-3 h-3 rounded border flex items-center justify-center shrink-0 ${
                          isSelected ? "bg-destructive border-destructive text-destructive-foreground" : "border-muted-foreground/30"
                        }`}>
                          {isSelected && <span className="text-[8px]">✓</span>}
                        </span>
                        {table}
                        {isAdmin && <Shield className="h-3 w-3 text-primary ml-auto" />}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {selectedClearTables.length} table{selectedClearTables.length !== 1 ? "s" : ""} selected
                {protectAdmin && " · Admin data protected"}
              </p>
            </div>

            {/* Confirmation */}
            {selectedClearTables.length > 0 && (
              <div className="space-y-2 pt-2 border-t">
                <p className="text-sm text-destructive font-medium">
                  Type <strong>DELETE</strong> to confirm:
                </p>
                <Input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="Type DELETE"
                  className="font-mono"
                />
              </div>
            )}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setConfirmText(""); }}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={selectedClearTables.length === 0 || confirmText !== "DELETE"}
              onClick={executeClear}
            >
              Clear {selectedClearTables.length} Table{selectedClearTables.length !== 1 ? "s" : ""}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {selectedTable && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="h-4 w-4" /> {selectedTable}
              <Badge variant="secondary">{tableData.length} rows</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loadingData ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">Loading...</div>
            ) : tableData.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">No data</div>
            ) : (
              <div className="overflow-auto max-h-[500px]">
                <table className="w-full text-xs">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      {Object.keys(tableData[0]).map((key) => (
                        <th key={key} className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">{key}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tableData.map((row, i) => (
                      <tr key={i} className="border-t border-border hover:bg-muted/50">
                        {Object.values(row).map((val, j) => (
                          <td key={j} className="px-3 py-2 whitespace-nowrap max-w-[200px] truncate">
                            {val === null ? <span className="text-muted-foreground italic">null</span> : typeof val === "object" ? JSON.stringify(val).slice(0, 50) : String(val)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Recovery Hub - shown after database clear */}
      {showRecoveryHub && (
        <Card className="border-2 border-primary/50 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <AlertTriangle className="h-5 w-5 text-primary" />
              System Recovery Hub
            </CardTitle>
            <CardDescription>
              Tables have been cleared. An automatic backup was created before clearing. Choose how to proceed:
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Card className="cursor-pointer hover:shadow-md transition-shadow border-primary/30" onClick={() => window.location.href = "/setup"}>
                <CardContent className="p-4 text-center">
                  <RefreshCw className="h-8 w-8 mx-auto mb-2 text-primary" />
                  <p className="font-semibold text-sm">Re-initialize System</p>
                  <p className="text-xs text-muted-foreground mt-1">Start fresh — set up admin account and configure from scratch</p>
                </CardContent>
              </Card>
              <Card className="border-primary/30">
                <CardContent className="p-4 text-center">
                  <Upload className="h-8 w-8 mx-auto mb-2 text-primary" />
                  <p className="font-semibold text-sm mb-2">Restore from Backup</p>
                  <p className="text-xs text-muted-foreground mb-3">Select a backup to restore all data</p>
                  {recoveryBackups.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">No backups available</p>
                  ) : (
                    <div className="space-y-1 max-h-40 overflow-auto text-left">
                      {recoveryBackups.slice(0, 5).map((b: any) => (
                        <div key={b.id} className="flex items-center justify-between p-2 rounded bg-muted/50 hover:bg-muted">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium truncate">{b.label || "Unnamed"}</p>
                            <p className="text-xs text-muted-foreground">{new Date(b.created_at).toLocaleString()}</p>
                          </div>
                          <Button size="sm" variant="outline" className="ml-2 shrink-0" onClick={() => restoreFromRecovery(b.id)}>
                            Restore
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowRecoveryHub(false)} className="w-full">
              Dismiss
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Error Logs
function ErrorLogs({ pin }: { pin: string }) {
  const [errors, setErrors] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [typeFilter, setTypeFilter] = useState("all");
  const [resolvedFilter, setResolvedFilter] = useState("all");
  const [selectedError, setSelectedError] = useState<any>(null);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const { toast } = useToast();

  const loadErrors = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("dev-tools", {
        body: { action: "get_error_logs", pin, type_filter: typeFilter, resolved_filter: resolvedFilter },
      });
      if (error) throw error;
      setErrors(data?.data || []);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [pin, typeFilter, resolvedFilter, toast]);

  useEffect(() => { loadErrors(); }, [loadErrors]);

  const resolveError = async (errorId: string) => {
    try {
      await supabase.functions.invoke("dev-tools", {
        body: { action: "resolve_error", pin, error_id: errorId, resolution_notes: resolutionNotes },
      });
      toast({ title: "Resolved" });
      setSelectedError(null);
      setResolutionNotes("");
      loadErrors();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const clearLogs = async () => {
    try {
      await supabase.functions.invoke("dev-tools", { body: { action: "clear_error_logs", pin } });
      toast({ title: "Logs cleared" });
      setErrors([]);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const typeColors: Record<string, string> = {
    client: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20",
    edge: "bg-red-500/10 text-red-700 border-red-500/20",
    auth: "bg-purple-500/10 text-purple-700 border-purple-500/20",
    api: "bg-blue-500/10 text-blue-700 border-blue-500/20",
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="client">Client</SelectItem>
            <SelectItem value="edge">Edge Function</SelectItem>
            <SelectItem value="auth">Auth</SelectItem>
            <SelectItem value="api">API</SelectItem>
          </SelectContent>
        </Select>
        <Select value={resolvedFilter} onValueChange={setResolvedFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="unresolved">Unresolved</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={loadErrors} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
        <div className="ml-auto">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm"><Trash2 className="h-4 w-4 mr-1" /> Clear All Logs</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear all error logs?</AlertDialogTitle>
                <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={clearLogs}>Clear</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <Badge variant="secondary">{errors.length} errors</Badge>

      {errors.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <CheckCircle className="h-12 w-12 mb-2 text-green-500" />
            <p>No errors found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {errors.map((err) => (
            <Card key={err.id} className={`cursor-pointer hover:shadow-md transition-shadow ${err.resolved ? "opacity-60" : ""}`}
              onClick={() => setSelectedError(err)}>
              <CardContent className="p-3 flex items-start gap-3">
                <div className="mt-0.5">
                  {err.resolved ? <CheckCircle className="h-5 w-5 text-green-500" /> : <AlertTriangle className="h-5 w-5 text-destructive" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${typeColors[err.type] || ""}`}>{err.type}</span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {new Date(err.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm font-medium truncate">{err.message}</p>
                  {err.source && <p className="text-xs text-muted-foreground truncate">{err.source}</p>}
                </div>
                <Eye className="h-4 w-4 text-muted-foreground" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Error Detail Dialog */}
      {selectedError && (
        <AlertDialog open={!!selectedError} onOpenChange={() => setSelectedError(null)}>
          <AlertDialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full border ${typeColors[selectedError.type] || ""}`}>{selectedError.type}</span>
                Error Detail
              </AlertDialogTitle>
            </AlertDialogHeader>
            <div className="space-y-3 text-sm">
              <div>
                <label className="font-medium text-muted-foreground">Message</label>
                <p className="mt-1">{selectedError.message}</p>
              </div>
              {selectedError.source && (
                <div>
                  <label className="font-medium text-muted-foreground">Source</label>
                  <p className="mt-1 font-mono text-xs">{selectedError.source}</p>
                </div>
              )}
              {selectedError.stack_trace && (
                <div>
                  <label className="font-medium text-muted-foreground">Stack Trace</label>
                  <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-auto max-h-40 font-mono">{selectedError.stack_trace}</pre>
                </div>
              )}
              {selectedError.metadata && (
                <div>
                  <label className="font-medium text-muted-foreground">Metadata</label>
                  <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-auto">{JSON.stringify(selectedError.metadata, null, 2)}</pre>
                </div>
              )}
              <div>
                <label className="font-medium text-muted-foreground">Timestamp</label>
                <p className="mt-1">{new Date(selectedError.created_at).toLocaleString()}</p>
              </div>
              {selectedError.resolved && selectedError.resolution_notes && (
                <div>
                  <label className="font-medium text-muted-foreground">Resolution</label>
                  <p className="mt-1 text-green-700">{selectedError.resolution_notes}</p>
                </div>
              )}
              {!selectedError.resolved && (
                <div className="space-y-2 pt-2 border-t">
                  <label className="font-medium text-muted-foreground">Mark as Resolved</label>
                  <Textarea
                    placeholder="Resolution notes (what was done to fix this)..."
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    rows={2}
                  />
                  <Button size="sm" onClick={() => resolveError(selectedError.id)}>
                    <CheckCircle className="h-4 w-4 mr-1" /> Resolve
                  </Button>
                </div>
              )}
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Close</AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}

// Backup Tools
function BackupTools({ pin }: { pin: string }) {
  const [backups, setBackups] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [backupLabel, setBackupLabel] = useState("");
  const { toast } = useToast();

  const loadBackups = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("dev-tools", {
        body: { action: "list_backups", pin },
      });
      if (error) throw error;
      setBackups(data?.data || []);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [pin, toast]);

  useEffect(() => { loadBackups(); }, [loadBackups]);

  const createBackup = async () => {
    setCreating(true);
    try {
      const { error } = await supabase.functions.invoke("dev-tools", {
        body: { action: "create_backup", pin, label: backupLabel || undefined },
      });
      if (error) throw error;
      toast({ title: "Backup Created" });
      setBackupLabel("");
      loadBackups();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const restoreBackup = async (id: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("dev-tools", {
        body: { action: "restore_backup", pin, backup_id: id },
      });
      if (error) throw error;
      toast({ title: "Backup Restored", description: `${data?.results?.length} tables processed` });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const deleteBackup = async (id: string) => {
    try {
      await supabase.functions.invoke("dev-tools", {
        body: { action: "delete_backup", pin, backup_id: id },
      });
      toast({ title: "Backup Deleted" });
      loadBackups();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base">Create Backup</CardTitle>
          <CardDescription>Snapshot all tables for later restoration</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Input
            placeholder="Backup label (optional)"
            value={backupLabel}
            onChange={(e) => setBackupLabel(e.target.value)}
            className="flex-1"
          />
          <Button onClick={createBackup} disabled={creating}>
            <Download className="h-4 w-4 mr-1" /> {creating ? "Creating..." : "Create Backup"}
          </Button>
        </CardContent>
      </Card>

      <div className="flex items-center gap-2">
        <h3 className="text-sm font-medium">Saved Backups</h3>
        <Badge variant="secondary">{backups.length}</Badge>
        <Button variant="ghost" size="sm" onClick={loadBackups} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {backups.length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12 text-muted-foreground">
            No backups yet
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {backups.map((b) => (
            <Card key={b.id}>
              <CardContent className="p-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{b.label || "Unnamed backup"}</p>
                  <p className="text-xs text-muted-foreground">{new Date(b.created_at).toLocaleString()}</p>
                </div>
                <div className="flex gap-1">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm"><Upload className="h-4 w-4 mr-1" /> Restore</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Restore this backup?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will clear all current data and replace it with data from this backup. This cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => restoreBackup(b.id)}>Restore</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm"><Trash2 className="h-4 w-4" /></Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete this backup?</AlertDialogTitle>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteBackup(b.id)}>Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
