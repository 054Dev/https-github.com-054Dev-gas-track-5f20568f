import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { PasswordStrength } from "@/components/PasswordStrength";
import { PasswordInput } from "@/components/PasswordInput";
import { Header } from "@/components/Header";
import { BackButton } from "@/components/BackButton";
import { Footer } from "@/components/Footer";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { InfoIcon, Trash2, AlertTriangle } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { validateAdminPasswordPolicy, validateCustomerPasswordPolicy } from "@/lib/password-utils";

export default function Settings() {
  const [loading, setLoading] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [shopName, setShopName] = useState("");
  const [address, setAddress] = useState("");
  const [userRole, setUserRole] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [deletionReason, setDeletionReason] = useState("");
  const [showDeletionDialog, setShowDeletionDialog] = useState(false);
  const [showContactEditWarning, setShowContactEditWarning] = useState(false);
  const [pendingProfileUpdate, setPendingProfileUpdate] = useState<(() => Promise<void>) | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [showEmailChangeDialog, setShowEmailChangeDialog] = useState(false);
  // Track original values for change detection
  const [originalValues, setOriginalValues] = useState({
    fullName: "", phone: "", shopName: "", address: "", username: "",
  });
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/login");
        return;
      }

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      setUserRole(roleData?.role || null);
      setEmail(user.email || "");

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (profileData) {
        setFullName(profileData.full_name);
        setPhone(profileData.phone || "");
        setUsername(profileData.username);
      }

      // Load customer-specific data
      const { data: customerData } = await supabase
        .from("customers")
        .select("id, shop_name, address, phone, in_charge_name")
        .eq("user_id", user.id)
        .maybeSingle();

      if (customerData) {
        setCustomerId(customerData.id);
        setShopName(customerData.shop_name || "");
        setAddress(customerData.address || "");
        // Use customer phone if profile phone is empty
        if (!profileData?.phone && customerData.phone) {
          setPhone(customerData.phone);
        }
        setOriginalValues({
          fullName: profileData?.full_name || customerData.in_charge_name || "",
          phone: profileData?.phone || customerData.phone || "",
          shopName: customerData.shop_name || "",
          address: customerData.address || "",
          username: profileData?.username || "",
        });
      } else {
        setOriginalValues({
          fullName: profileData?.full_name || "",
          phone: profileData?.phone || "",
          shopName: "",
          address: "",
          username: profileData?.username || "",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load user data",
        variant: "destructive",
      });
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast({
        title: "Password Mismatch",
        description: "New passwords do not match",
        variant: "destructive",
      });
      return;
    }

    const isAdminOrStaff = userRole && ["admin", "co_admin", "staff"].includes(userRole);
    const { valid, message } = isAdminOrStaff 
      ? validateAdminPasswordPolicy(newPassword, { email, username, fullName, phone })
      : validateCustomerPasswordPolicy(newPassword);

    if (!valid) {
      toast({
        title: "Weak Password",
        description: message,
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Password updated successfully",
      });

      setNewPassword("");
      setConfirmPassword("");
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

  const executeProfileUpdate = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Update profile
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          full_name: fullName,
          phone: phone,
          username: username,
        })
        .eq("id", user.id);

      if (profileError) throw profileError;

      // Update customer record if exists
      if (customerId) {
        const { error: customerError } = await supabase
          .from("customers")
          .update({
            in_charge_name: fullName,
            phone: phone,
            shop_name: shopName,
            address: address,
            username: username,
          })
          .eq("id", customerId);

        if (customerError) throw customerError;
      }

      // Detect what changed and send notification
      const changes: string[] = [];
      if (fullName !== originalValues.fullName) changes.push(`Name: "${originalValues.fullName}" → "${fullName}"`);
      if (phone !== originalValues.phone) changes.push(`Phone: "${originalValues.phone}" → "${phone}"`);
      if (username !== originalValues.username) changes.push(`Username: "${originalValues.username}" → "${username}"`);
      if (shopName !== originalValues.shopName) changes.push(`Shop: "${originalValues.shopName}" → "${shopName}"`);
      if (address !== originalValues.address) changes.push(`Address: "${originalValues.address}" → "${address}"`);

      if (changes.length > 0 && customerId) {
        const changeMsg = changes.join(", ");

        // Notify admin if user is not admin
        const isAdmin = userRole === "admin" || userRole === "co_admin";
        if (!isAdmin) {
          await supabase.from("notifications").insert({
            customer_id: customerId,
            type: "contact_request",
            message: `${fullName || username} updated their contact details: ${changeMsg}`,
            status: "pending",
          });
        }

        // Notify the user themselves (confirmation)
        await supabase.from("notifications").insert({
          customer_id: customerId,
          type: "order_created",
          message: `Your contact details have been updated successfully: ${changeMsg}`,
          status: "pending",
        });
      }

      // Update original values
      setOriginalValues({ fullName, phone, shopName, address, username });

      toast({
        title: "Success",
        description: "Profile updated successfully",
      });
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

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check if contact details changed
    const hasContactChanges =
      phone !== originalValues.phone ||
      fullName !== originalValues.fullName ||
      username !== originalValues.username ||
      shopName !== originalValues.shopName ||
      address !== originalValues.address;

    if (hasContactChanges) {
      setPendingProfileUpdate(() => executeProfileUpdate);
      setShowContactEditWarning(true);
    } else {
      await executeProfileUpdate();
    }
  };

  const handleAccountDeletion = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error: requestError } = await supabase
        .from("deletion_requests")
        .insert({
          user_id: user.id,
          reason: deletionReason || "Self-requested account deletion",
          status: "pending",
        });

      if (requestError) throw requestError;

      // Create notification for admins
      if (customerId) {
        await supabase
          .from("notifications")
          .insert({
            customer_id: customerId,
            type: "account_deletion_request",
            message: `Account deletion requested by ${fullName || username}. Reason: ${deletionReason || "No reason provided"}`,
          });
      }

      toast({
        title: "Request Submitted",
        description: userRole === "customer"
          ? "Your account deletion request has been sent to administrators"
          : "Your account deletion request has been created. Another admin will need to approve it.",
      });
      setShowDeletionDialog(false);
      setDeletionReason("");
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

  const isAdmin = userRole === "admin" || userRole === "co_admin";
  const isCustomer = userRole === "customer";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <div className="container py-8 max-w-4xl mx-auto flex-1">
        <div className="mb-6">
          <BackButton />
        </div>
        <h1 className="text-3xl font-bold mb-6">Account Settings</h1>

        <div className="space-y-6">
          {/* Profile Information */}
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Update your personal information</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleProfileUpdate} className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
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
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                </div>

                {isCustomer && (
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="shopName">Shop Name</Label>
                      <Input
                        id="shopName"
                        value={shopName}
                        onChange={(e) => setShopName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="address">Address</Label>
                      <Input
                        id="address"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      disabled
                    />
                    {isCustomer ? (
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        className="px-0 h-auto text-xs"
                        onClick={() => {
                          setNewEmail(email);
                          setShowEmailChangeDialog(true);
                        }}
                      >
                        Change email address
                      </Button>
                    ) : (
                      <p className="text-xs text-muted-foreground">Email cannot be changed</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                    />
                  </div>
                </div>

                <Button type="submit" disabled={loading}>
                  {loading ? "Updating..." : "Update Profile"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Contact Edit Warning Dialog */}
          <AlertDialog open={showContactEditWarning} onOpenChange={setShowContactEditWarning}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  Confirm Contact Details Change
                </AlertDialogTitle>
                <AlertDialogDescription>
                  You are about to update your contact details. This change will be logged and{" "}
                  {!isAdmin ? "administrators will be notified." : "recorded in the system."}
                  {" "}Please ensure your new details are accurate.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={async () => {
                    setShowContactEditWarning(false);
                    if (pendingProfileUpdate) {
                      await pendingProfileUpdate();
                      setPendingProfileUpdate(null);
                    }
                  }}
                >
                  Confirm Changes
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Email Change Dialog */}
          <AlertDialog open={showEmailChangeDialog} onOpenChange={setShowEmailChangeDialog}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  Change Email Address
                </AlertDialogTitle>
                <AlertDialogDescription>
                  A confirmation email will be sent to the new address. Your email won't change until you verify it by clicking the link in that email.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-2 py-2">
                <Label htmlFor="newEmail">New Email Address</Label>
                <Input
                  id="newEmail"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="Enter new email"
                />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={async () => {
                    if (!newEmail || newEmail === email) {
                      toast({ title: "Error", description: "Please enter a different email address", variant: "destructive" });
                      return;
                    }
                    try {
                      const { error } = await supabase.auth.updateUser({ email: newEmail });
                      if (error) throw error;

                      // Send notification about email change if customer
                      if (customerId) {
                        const changeMsg = `Email change requested: "${email}" → "${newEmail}"`;
                        if (!isAdmin) {
                          await supabase.from("notifications").insert({
                            customer_id: customerId,
                            type: "contact_request",
                            message: `${fullName || username} requested an email change: ${changeMsg}`,
                            status: "pending",
                          });
                        }
                        await supabase.from("notifications").insert({
                          customer_id: customerId,
                          type: "order_created",
                          message: `Email change requested. A confirmation link has been sent to ${newEmail}. Your email will update once verified.`,
                          status: "pending",
                        });
                      }

                      toast({
                        title: "Verification Email Sent",
                        description: `A confirmation email has been sent to ${newEmail}. Please check your inbox and click the verification link.`,
                      });
                      setShowEmailChangeDialog(false);
                    } catch (error: any) {
                      toast({ title: "Error", description: error.message, variant: "destructive" });
                    }
                  }}
                >
                  Send Verification Email
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>Update your account password</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <PasswordInput
                    id="newPassword"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <PasswordInput
                    id="confirmPassword"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
                <PasswordStrength password={newPassword} />
                <Button type="submit" disabled={loading}>
                  {loading ? "Changing Password..." : "Change Password"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Delete Account - only for non-admin users */}
          {!isAdmin && (
            <Card className="border-destructive">
              <CardHeader>
                <CardTitle className="text-destructive">Danger Zone</CardTitle>
                <CardDescription>
                  Request account deletion (requires admin approval)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AlertDialog open={showDeletionDialog} onOpenChange={setShowDeletionDialog}>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="gap-2">
                      <Trash2 className="h-4 w-4" />
                      Request Account Deletion
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Request Account Deletion?</AlertDialogTitle>
                      <AlertDialogDescription className="space-y-4">
                        <p>
                          This will send a deletion request to the administrators.
                          Your account will remain active until an admin approves your request.
                        </p>
                        <div className="space-y-2">
                          <Label htmlFor="reason">Reason for deletion (optional)</Label>
                          <Textarea
                            id="reason"
                            placeholder="Why would you like to delete your account?"
                            value={deletionReason}
                            onChange={(e) => setDeletionReason(e.target.value)}
                            rows={3}
                          />
                        </div>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleAccountDeletion}
                        disabled={loading}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {loading ? "Processing..." : "Submit Request"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
}
