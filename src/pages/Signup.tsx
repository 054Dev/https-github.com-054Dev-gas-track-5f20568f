import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Header } from "@/components/Header";
import { PasswordStrength } from "@/components/PasswordStrength";
import { PasswordInput } from "@/components/PasswordInput";
import { validateCustomerPasswordPolicy, validateEmail } from "@/lib/password-utils";
import { lovable } from "@/integrations/lovable/index";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

export default function Signup() {
  const [formData, setFormData] = useState({
    shopName: "",
    inChargeName: "",
    username: "",
    email: "",
    phone: "",
    address: "",
    password: "",
    confirmPassword: "",
  });
  const [loading, setLoading] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const [usernameDebounce, setUsernameDebounce] = useState<ReturnType<typeof setTimeout> | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Username availability check
  const checkUsernameAvailability = async (username: string) => {
    if (!username || username.length < 3) {
      setUsernameStatus("idle");
      return;
    }
    setUsernameStatus("checking");
    try {
      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", username)
        .maybeSingle();
      
      if (!existing) {
        // Also check customers table
        const { data: customerExisting } = await supabase
          .from("customers")
          .select("id")
          .eq("username", username)
          .maybeSingle();
        setUsernameStatus(customerExisting ? "taken" : "available");
      } else {
        setUsernameStatus("taken");
      }
    } catch {
      setUsernameStatus("idle");
    }
  };

  const handleUsernameChange = (value: string) => {
    setFormData({ ...formData, username: value });
    if (usernameDebounce) clearTimeout(usernameDebounce);
    const timeout = setTimeout(() => checkUsernameAvailability(value), 500);
    setUsernameDebounce(timeout);
  };

  useEffect(() => {
    return () => {
      if (usernameDebounce) clearTimeout(usernameDebounce);
    };
  }, [usernameDebounce]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (usernameStatus === "taken") {
      toast({ title: "Username Taken", description: "Please choose a different username.", variant: "destructive" });
      return;
    }
    setLoading(true);

    try {
      if (formData.password !== formData.confirmPassword) {
        throw new Error("Passwords do not match");
      }

      const emailValidation = validateEmail(formData.email);
      if (!emailValidation.valid) {
        throw new Error(emailValidation.message);
      }

      const { valid, message } = validateCustomerPasswordPolicy(formData.password);
      if (!valid) {
        throw new Error(message);
      }

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/customer/dashboard`,
          data: {
            username: formData.username,
            full_name: formData.inChargeName,
            phone: formData.phone,
          },
        },
      });

      if (authError) throw authError;

      if (authData.user) {
        const { error: roleError } = await supabase
          .from("user_roles")
          .insert({
            user_id: authData.user.id,
            role: "customer",
          });

        if (roleError) throw roleError;

        const { error: profileError } = await supabase.from("profiles").insert({
          id: authData.user.id,
          username: formData.username,
          full_name: formData.inChargeName,
          phone: formData.phone,
        });

        if (profileError) throw profileError;

        const { error: customerError } = await supabase
          .from("customers")
          .insert({
            user_id: authData.user.id,
            username: formData.username,
            shop_name: formData.shopName,
            in_charge_name: formData.inChargeName,
            email: formData.email,
            phone: formData.phone,
            address: formData.address,
            price_per_kg: 150,
          });

        if (customerError) throw customerError;

        toast({
          title: "Success!",
          description: "Your account has been created. Please sign in.",
        });

        navigate("/login");
      }
    } catch (error: any) {
      toast({
        title: "Signup Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthSignup = async (provider: "google" | "apple") => {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast({ title: `${provider} Sign-Up Failed`, description: String(result.error), variant: "destructive" });
        setLoading(false);
        return;
      }
      if (result.redirected) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: existing } = await supabase
          .from("customers")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();
        if (existing) {
          navigate("/customer/dashboard", { replace: true });
        } else {
          toast({ title: "Complete Your Profile", description: "Please fill in the form to complete registration." });
          setLoading(false);
        }
      }
    } catch (e: any) {
      toast({ title: `${provider} Sign-Up Failed`, description: e.message, variant: "destructive" });
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container flex items-center justify-center py-12">
        <Card className="w-full max-w-2xl">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center">Create Customer Account</CardTitle>
            <CardDescription className="text-center">
              Sign up as a new customer for Fine Gas Limited
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* OAuth buttons above form */}
            <div className="space-y-3 mb-4">
              <p className="text-xs text-center text-muted-foreground">Sign up with other methods</p>
              <div className="flex justify-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-10 w-10"
                  disabled={loading}
                  onClick={() => handleOAuthSignup("google")}
                  title="Sign up with Google"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-10 w-10"
                  disabled={loading}
                  onClick={() => handleOAuthSignup("apple")}
                  title="Sign up with Apple"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>
                </Button>
              </div>
            </div>

            <div className="relative mb-4">
              <Separator />
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
                or create account with email
              </span>
            </div>

            <form onSubmit={handleSignup} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="shopName">Shop Name *</Label>
                  <Input
                    id="shopName"
                    placeholder="Your shop name"
                    value={formData.shopName}
                    onChange={(e) => setFormData({ ...formData, shopName: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="inChargeName">Person in Charge *</Label>
                  <Input
                    id="inChargeName"
                    placeholder="Your full name"
                    value={formData.inChargeName}
                    onChange={(e) => setFormData({ ...formData, inChargeName: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Username *</Label>
                  <div className="relative">
                    <Input
                      id="username"
                      placeholder="username"
                      value={formData.username}
                      onChange={(e) => handleUsernameChange(e.target.value)}
                      required
                      className={
                        usernameStatus === "available"
                          ? "border-green-500 text-green-700 pr-8"
                          : usernameStatus === "taken"
                          ? "border-red-500 text-red-700 pr-8"
                          : "pr-8"
                      }
                    />
                    {usernameStatus === "checking" && (
                      <Loader2 className="absolute right-2 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                    {usernameStatus === "available" && (
                      <CheckCircle className="absolute right-2 top-2.5 h-4 w-4 text-green-500" />
                    )}
                    {usernameStatus === "taken" && (
                      <XCircle className="absolute right-2 top-2.5 h-4 w-4 text-red-500" />
                    )}
                  </div>
                  {usernameStatus === "available" && (
                    <p className="text-xs text-green-600">Username is available!</p>
                  )}
                  {usernameStatus === "taken" && (
                    <p className="text-xs text-red-600">Username already taken. Choose another username.</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number *</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+254..."
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    placeholder="Your address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="password">Password *</Label>
                  <PasswordInput
                    id="password"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                  />
                  <PasswordStrength password={formData.password} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password *</Label>
                  <PasswordInput
                    id="confirmPassword"
                    placeholder="••••••••"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    required
                  />
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={loading || usernameStatus === "taken"}>
                {loading ? "Creating account..." : "Create Account"}
              </Button>
            </form>

            <div className="mt-4 text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link to="/login" className="text-primary hover:underline">
                Sign in
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
