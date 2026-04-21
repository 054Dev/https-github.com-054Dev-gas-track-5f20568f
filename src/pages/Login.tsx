import { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Header } from "@/components/Header";
import { PasswordInput } from "@/components/PasswordInput";
import { lovable } from "@/integrations/lovable/index";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

export default function Login() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Check if already logged in
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        handlePostAuthRedirect(session.user.id);
      } else {
        setPageLoading(false);
      }
    });
  }, []);

  const handlePostAuthRedirect = useCallback(async (userId: string) => {
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();

    if (roleData?.role === "admin" || roleData?.role === "co_admin" || roleData?.role === "staff") {
      navigate("/admin/dashboard", { replace: true });
    } else {
      const { data: customerData } = await supabase
        .from("customers")
        .select("id, status, deleted_at")
        .eq("user_id", userId)
        .maybeSingle();

      if (customerData) {
        // Block suspended/inactive accounts at the gate
        if (customerData.status === "suspended" || customerData.status === "inactive" || customerData.deleted_at) {
          await supabase.auth.signOut();
          toast({
            title: "Account Suspended",
            description: "This account has been suspended. Please contact the administrator.",
            variant: "destructive",
          });
          setPageLoading(false);
          return;
        }
        navigate("/customer/dashboard", { replace: true });
      } else {
        toast({
          title: "Access Denied",
          description: "No customer profile found. Please contact admin.",
          variant: "destructive",
        });
        await supabase.auth.signOut();
        setPageLoading(false);
      }
    }
  }, [navigate, toast]);

  // Resolve identifier (username/phone) to email
  const resolveEmail = async (input: string): Promise<string> => {
    const trimmed = input.trim();
    // If it looks like an email, use directly
    if (trimmed.includes("@")) return trimmed;

    // Try username lookup in profiles
    const { data: profileByUsername } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", trimmed)
      .maybeSingle();

    if (profileByUsername) {
      // Get email from auth via a workaround: check customers table
      const { data: customer } = await supabase
        .from("customers")
        .select("email")
        .eq("user_id", profileByUsername.id)
        .maybeSingle();
      if (customer?.email) return customer.email;
    }

    // Try phone lookup in customers
    const phoneVariants = [trimmed, `+${trimmed}`, `+254${trimmed.replace(/^0/, "")}`];
    for (const phone of phoneVariants) {
      const { data: customerByPhone } = await supabase
        .from("customers")
        .select("email")
        .eq("phone", phone)
        .maybeSingle();
      if (customerByPhone?.email) return customerByPhone.email;
    }

    // Try username in customers table
    const { data: customerByUsername } = await supabase
      .from("customers")
      .select("email")
      .eq("username", trimmed)
      .maybeSingle();
    if (customerByUsername?.email) return customerByUsername.email;

    // Fall through — use as-is (will fail at auth)
    return trimmed;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const email = await resolveEmail(identifier);

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      if (data.user) {
        await handlePostAuthRedirect(data.user.id);
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

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast({ title: "Google Sign-In Failed", description: String(result.error), variant: "destructive" });
        setLoading(false);
        return;
      }
      if (result.redirected) return;
      // After OAuth returns, get user and redirect
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await handlePostAuthRedirect(user.id);
      }
    } catch (e: any) {
      toast({ title: "Google Sign-In Failed", description: e.message, variant: "destructive" });
      setLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("apple", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast({ title: "Apple Sign-In Failed", description: String(result.error), variant: "destructive" });
        setLoading(false);
        return;
      }
      if (result.redirected) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await handlePostAuthRedirect(user.id);
      }
    } catch (e: any) {
      toast({ title: "Apple Sign-In Failed", description: e.message, variant: "destructive" });
      setLoading(false);
    }
  };

  if (pageLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container flex items-center justify-center py-12">
          <div className="w-full max-w-md space-y-4">
            <Card>
              <CardHeader>
                <Skeleton className="h-8 w-48 mx-auto" />
                <Skeleton className="h-4 w-64 mx-auto mt-2" />
              </CardHeader>
              <CardContent className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container flex items-center justify-center py-12">
        <div className="w-full max-w-md space-y-4">
          <Card>
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl font-bold text-center">Welcome Back</CardTitle>
              <CardDescription className="text-center">
                Enter your credentials to access your account
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* OAuth buttons above form */}
              <div className="space-y-3 mb-4">
                <p className="text-xs text-center text-muted-foreground">Sign in with other methods</p>
                <div className="flex justify-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-10 w-10"
                    disabled={loading}
                    onClick={handleGoogleSignIn}
                    title="Sign in with Google"
                  >
                    <svg className="h-5 w-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-10 w-10"
                    disabled={loading}
                    onClick={handleAppleSignIn}
                    title="Sign in with Apple"
                  >
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>
                  </Button>
                </div>
              </div>

              <div className="relative mb-4">
                <Separator />
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
                  or sign in with email
                </span>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="identifier">Email, Username, or Phone</Label>
                  <Input
                    id="identifier"
                    type="text"
                    placeholder="email, username, or phone"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
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
