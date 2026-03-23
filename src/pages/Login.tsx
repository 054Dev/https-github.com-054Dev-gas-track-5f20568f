import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Header } from "@/components/Header";
import { PasswordInput } from "@/components/PasswordInput";
import { AlertTriangle, Upload, RefreshCw } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [systemStatus, setSystemStatus] = useState<{
    initialized: boolean;
    hasBackups: boolean;
    recentBackups: any[];
  } | null>(null);
  const [checkingSystem, setCheckingSystem] = useState(true);
  const [restoring, setRestoring] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkSystemInitialized();
  }, []);

  const checkSystemInitialized = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("dev-tools", {
        body: { action: "check_system_initialized" },
      });
      if (!error && data) {
        setSystemStatus(data);
      }
    } catch {
      // If check fails, assume initialized
    } finally {
      setCheckingSystem(false);
    }
  };

  const restoreBackup = async (backupId: string) => {
    setRestoring(true);
    try {
      // Need dev PIN for restore
      const pin = prompt("Enter developer PIN to restore backup:");
      if (!pin) { setRestoring(false); return; }

      const { data, error } = await supabase.functions.invoke("dev-tools", {
        body: { action: "restore_backup", pin, backup_id: backupId },
      });
      if (error) throw error;
      toast({ title: "Backup Restored", description: `${data?.results?.length} tables restored successfully.` });
      setSystemStatus(null);
      checkSystemInitialized();
    } catch (e: any) {
      toast({ title: "Restore Failed", description: e.message, variant: "destructive" });
    } finally {
      setRestoring(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", data.user.id)
          .maybeSingle();

        if (roleData?.role === "admin" || roleData?.role === "co_admin" || roleData?.role === "staff") {
          navigate("/admin/dashboard");
        } else {
          const { data: customerData } = await supabase
            .from("customers")
            .select("id")
            .eq("user_id", data.user.id)
            .maybeSingle();

          if (customerData) {
            navigate("/customer/dashboard");
          } else {
            toast({
              title: "Access Denied",
              description: "No customer profile found. Please contact admin.",
              variant: "destructive",
            });
            await supabase.auth.signOut();
          }
        }
      }
    } catch (error: any) {
      toast({
        title: "Login Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container flex items-center justify-center py-12">
        <div className="w-full max-w-md space-y-4">
          {/* System not initialized banner */}
          {!checkingSystem && systemStatus && !systemStatus.initialized && (
            <Card className="border-2 border-destructive/50 bg-destructive/5">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                  System Not Initialized
                </CardTitle>
                <CardDescription>
                  No admin account exists. Initialize the system or restore from a backup.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button className="w-full" onClick={() => navigate("/setup")}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Initialize System (Dev Setup)
                </Button>

                {systemStatus.hasBackups && systemStatus.recentBackups.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Or restore from backup:</p>
                    <div className="space-y-1.5 max-h-40 overflow-auto">
                      {systemStatus.recentBackups.map((b: any) => (
                        <div key={b.id} className="flex items-center justify-between p-2 rounded bg-muted/50 border">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium truncate">{b.label || "Unnamed"}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {new Date(b.created_at).toLocaleString()}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="ml-2 shrink-0"
                            disabled={restoring}
                            onClick={() => restoreBackup(b.id)}
                          >
                            <Upload className="h-3 w-3 mr-1" />
                            Restore
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl font-bold text-center">Welcome Back</CardTitle>
              <CardDescription className="text-center">
                Enter your credentials to access your account
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <PasswordInput
                    id="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Signing in..." : "Sign In"}
                </Button>
              </form>
              <div className="mt-4 text-center text-sm">
                <Link to="/forgot-password" className="text-primary hover:underline">
                  Forgot password?
                </Link>
              </div>
              <div className="mt-4 text-center text-sm text-muted-foreground">
                New customer?{" "}
                <Link to="/signup" className="text-primary hover:underline">
                  Create an account
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}