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
import { lovable } from "@/integrations/lovable/index";
import { Separator } from "@/components/ui/separator";

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

              <div className="relative my-4">
                <Separator />
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
                  or
                </span>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={loading}
                onClick={async () => {
                  setLoading(true);
                  try {
                    const result = await lovable.auth.signInWithOAuth("google", {
                      redirect_uri: window.location.origin,
                    });
                    if (result.error) {
                      toast({ title: "Google Sign-In Failed", description: String(result.error), variant: "destructive" });
                    }
                    if (result.redirected) return;
                    // Session set — check role and navigate
                    const { data: { user } } = await supabase.auth.getUser();
                    if (user) {
                      const { data: roleData } = await supabase
                        .from("user_roles")
                        .select("role")
                        .eq("user_id", user.id)
                        .maybeSingle();
                      if (roleData?.role === "admin" || roleData?.role === "co_admin" || roleData?.role === "staff") {
                        navigate("/admin/dashboard");
                      } else {
                        const { data: customerData } = await supabase
                          .from("customers")
                          .select("id")
                          .eq("user_id", user.id)
                          .maybeSingle();
                        if (customerData) {
                          navigate("/customer/dashboard");
                        } else {
                          toast({ title: "Access Denied", description: "No customer profile found. Please contact admin.", variant: "destructive" });
                          await supabase.auth.signOut();
                        }
                      }
                    }
                  } catch (e: any) {
                    toast({ title: "Google Sign-In Failed", description: e.message, variant: "destructive" });
                  } finally {
                    setLoading(false);
                  }
                }}
              >
                <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                Sign in with Google
              </Button>
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