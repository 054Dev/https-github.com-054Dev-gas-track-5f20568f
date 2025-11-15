import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { PasswordStrength } from "@/components/PasswordStrength";
import logo from "@/assets/logo.png";

export default function Setup() {
  const [step, setStep] = useState<"check" | "create" | "verify">("check");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const checkForAdmin = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("id")
        .in("role", ["admin", "co_admin"])
        .limit(1);

      if (error) throw error;

      if (data && data.length > 0) {
        toast({
          title: "Admin Already Exists",
          description: "An administrator account already exists. Redirecting to login.",
          variant: "destructive",
        });
        setTimeout(() => navigate("/login"), 2000);
      } else {
        setStep("create");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !phone || !username || !fullName) {
      toast({
        title: "Missing Fields",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Generate OTP
      const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Store OTP in database
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 10);
      
      const { error: otpError } = await supabase
        .from("admin_otps")
        .insert({
          email,
          phone,
          otp: generatedOtp,
          expires_at: expiresAt.toISOString(),
        });

      if (otpError) throw otpError;

      // TODO: Send OTP via SMS (placeholder for now)
      console.log("OTP for admin setup:", generatedOtp);
      
      toast({
        title: "OTP Sent",
        description: `An OTP has been sent to ${phone}. (Demo: ${generatedOtp})`,
      });

      setStep("verify");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const verifyAndSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast({
        title: "Password Mismatch",
        description: "Passwords do not match.",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 8) {
      toast({
        title: "Weak Password",
        description: "Password must be at least 8 characters long.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Verify OTP
      const { data: otpData, error: otpError } = await supabase
        .from("admin_otps")
        .select("*")
        .eq("email", email)
        .eq("otp", otp)
        .eq("used", false)
        .gt("expires_at", new Date().toISOString())
        .single();

      if (otpError || !otpData) {
        throw new Error("Invalid or expired OTP");
      }

      // Create user account
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username,
            full_name: fullName,
            phone,
          },
        },
      });

      if (authError) throw authError;

      // Mark OTP as used
      await supabase
        .from("admin_otps")
        .update({ used: true })
        .eq("id", otpData.id);

      // Assign admin role
      if (authData.user) {
        const { error: roleError } = await supabase
          .from("user_roles")
          .insert({
            user_id: authData.user.id,
            role: "admin",
          });

        if (roleError) throw roleError;
      }

      toast({
        title: "Success",
        description: "Admin account created successfully!",
      });

      setTimeout(() => navigate("/login"), 2000);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (step === "check") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <img src={logo} alt="Fine Gas Limited" className="h-24 mx-auto mb-4" />
            <CardTitle>Developer Setup</CardTitle>
            <CardDescription>
              Initialize your Fine Gas Limited system
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={checkForAdmin} disabled={loading} className="w-full">
              {loading ? "Checking..." : "Initialize System"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === "create") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <img src={logo} alt="Fine Gas Limited" className="h-24 mx-auto mb-4" />
            <CardTitle>Create Admin Account</CardTitle>
            <CardDescription>
              Set up the first administrator for your system
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={createAdmin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+254..."
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Sending OTP..." : "Send OTP"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <img src={logo} alt="Fine Gas Limited" className="h-24 mx-auto mb-4" />
          <CardTitle>Verify & Set Password</CardTitle>
          <CardDescription>
            Enter the OTP sent to your phone and set your password
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={verifyAndSetPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="otp">OTP Code</Label>
              <Input
                id="otp"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="Enter 6-digit OTP"
                maxLength={6}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            <PasswordStrength password={password} />
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Creating Account..." : "Create Admin Account"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
