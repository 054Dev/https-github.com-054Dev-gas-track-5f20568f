import { useState, useEffect, useCallback } from "react";
import { PageSkeleton } from "@/components/PageSkeleton";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { SubNav } from "@/components/SubNav";
import { BackButton } from "@/components/BackButton";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { NotificationBell } from "@/components/NotificationBell";
import { useNotifications } from "@/hooks/useNotifications";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Download, Upload, Trash2, RefreshCw, Clock, Shield } from "lucide-react";

export default function AdminBackups() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [backups, setBackups] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [backupLabel, setBackupLabel] = useState("");
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications({ isAdmin: true });

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { navigate("/login"); return; }

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (!roleData || !["admin", "co_admin"].includes(roleData.role)) {
      toast({ title: "Access Denied", description: "Admin access required.", variant: "destructive" });
      navigate("/");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .maybeSingle();

    setUser({ ...session.user, ...profile, role: roleData.role });
  };

  const loadBackups = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("dev-tools", {
        body: { action: "list_backups" },
      });
      if (error) throw error;
      setBackups(data?.data || []);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (user) loadBackups();
  }, [user, loadBackups]);

  const createBackup = async () => {
    setCreating(true);
    try {
      const { error } = await supabase.functions.invoke("dev-tools", {
        body: { action: "create_backup", label: backupLabel || undefined },
      });
      if (error) throw error;
      toast({ title: "Backup Created", description: "System snapshot saved successfully." });
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
        body: { action: "restore_backup", backup_id: id },
      });
      if (error) throw error;
      toast({ title: "Backup Restored", description: `${data?.results?.length} tables processed. Reload to see changes.` });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const deleteBackup = async (id: string) => {
    try {
      await supabase.functions.invoke("dev-tools", {
        body: { action: "delete_backup", backup_id: id },
      });
      toast({ title: "Backup Deleted" });
      loadBackups();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  if (!user) return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <SubNav role="admin" />
      <div className="container py-8 flex-1"><PageSkeleton variant="list" /></div>
      <Footer />
    </div>
  );

  const getBackupType = (label: string) => {
    if (label?.startsWith("Daily auto-backup")) return "daily";
    if (label?.startsWith("Auto-backup before")) return "auto";
    return "manual";
  };

  const badgeForType = (type: string) => {
    switch (type) {
      case "daily": return <Badge variant="secondary" className="text-xs">Daily</Badge>;
      case "auto": return <Badge variant="outline" className="text-xs border-yellow-500/50 text-yellow-700">Auto</Badge>;
      default: return <Badge className="text-xs">Manual</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header user={user} onLogout={handleLogout}>
        <NotificationBell notifications={notifications} unreadCount={unreadCount} onMarkAsRead={markAsRead} onMarkAllAsRead={markAllAsRead} notificationsPage="/admin/notifications" />
      </Header>
      <SubNav role={user.role} />
      <div className="container py-4 md:py-8 px-4 md:px-6 flex-1">
        <div className="mb-4"><BackButton /></div>
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" /> System Backups
          </h1>
          <p className="text-muted-foreground">Create, manage, and restore system snapshots. Daily backups run automatically.</p>
        </div>

        {/* Create Backup */}
        <Card className="mb-6">
          <CardHeader className="py-3">
            <CardTitle className="text-base">Create Backup</CardTitle>
            <CardDescription>Snapshot all system data for later restoration</CardDescription>
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

        {/* Backups List */}
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-sm font-medium">Saved Backups</h3>
          <Badge variant="secondary">{backups.length}</Badge>
          <Button variant="ghost" size="sm" onClick={loadBackups} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {backups.length === 0 ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12 text-muted-foreground">
              No backups yet. Create one to get started.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {backups.map((b) => {
              const type = getBackupType(b.label);
              return (
                <Card key={b.id}>
                  <CardContent className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {badgeForType(type)}
                      <div>
                        <p className="font-medium text-sm">{b.label || "Unnamed backup"}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {new Date(b.created_at).toLocaleString()}
                        </p>
                      </div>
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
                              This will replace all current data with data from this backup. An auto-backup of the current state will be created first.
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
                            <AlertDialogDescription>This backup will be permanently removed.</AlertDialogDescription>
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
              );
            })}
          </div>
        )}
      </div>
      <Footer role="admin" />
    </div>
  );
}
