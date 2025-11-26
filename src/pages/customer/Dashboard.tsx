import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { SubNav } from "@/components/SubNav";
import { BackButton } from "@/components/BackButton";
import { Footer } from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Receipt, DollarSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { PasswordStrength } from "@/components/PasswordStrength";

export default function CustomerDashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [customer, setCustomer] = useState<any>(null);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [stats, setStats] = useState({
    recentDeliveries: 0,
    totalReceipts: 0,
    pendingBalance: 0,
  });

  useEffect(() => {
    checkAuth();
    
    // Reload customer data when page becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkAuth();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const checkAuth = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      navigate("/login");
      return;
    }

    const { data: customerData } = await supabase
      .from("customers")
      .select("*")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (!customerData) {
      toast({
        title: "Access Denied",
        description: "No customer profile found. Please contact admin.",
        variant: "destructive",
      });
      navigate("/");
      return;
    }

    setUser(session.user);
    setCustomer(customerData);
    loadStats(customerData.id);
    
    // Check if using default password
    if (session.user.user_metadata?.needs_password_change) {
      setShowPasswordDialog(true);
    }
  };

  const loadStats = async (customerId: string) => {
    const { count: deliveriesCount } = await supabase
      .from("deliveries")
      .select("*", { count: "exact", head: true })
      .eq("customer_id", customerId);

    const { count: receiptsCount } = await supabase
      .from("receipts")
      .select("*", { count: "exact", head: true })
      .eq("customer_id", customerId);

    const { data: customerBalance } = await supabase
      .from("customers")
      .select("arrears_balance")
      .eq("id", customerId)
      .single();

    setStats({
      recentDeliveries: deliveriesCount || 0,
      totalReceipts: receiptsCount || 0,
      pendingBalance: Number(customerBalance?.arrears_balance || 0),
    });
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 8) {
      toast({
        title: "Error",
        description: "Password must be at least 8 characters",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
        data: { needs_password_change: false },
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Password updated successfully",
      });

      setShowPasswordDialog(false);
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  if (!user || !customer) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header user={{ username: customer.username }} onLogout={handleLogout} />
      <SubNav role="customer" />
      <div className="container py-8 flex-1">
        <div className="mb-6">
          <BackButton />
        </div>
        <div className="mb-8">
          <Card className="bg-primary/10 border-primary/20">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">{customer.shop_name}</h2>
                  <p className="text-muted-foreground">
                    Welcome back, {customer.in_charge_name}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Your Rate</p>
                  <p className="text-2xl font-bold text-primary">
                    KES {customer.price_per_kg}/kg
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Total Deliveries
              </CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.recentDeliveries}</div>
              <p className="text-xs text-muted-foreground">
                All-time deliveries
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Receipts</CardTitle>
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalReceipts}</div>
              <p className="text-xs text-muted-foreground">
                Available for download
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Pending Balance
              </CardTitle>
              <DollarSign className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">
                KES {stats.pendingBalance.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">Outstanding amount</p>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate("/customer/place-order")}>
            <CardHeader>
              <CardTitle>Place Order</CardTitle>
              <p className="text-sm text-muted-foreground">Request a new gas delivery</p>
            </CardHeader>
            <CardContent>
              <Button className="w-full">
                <Package className="mr-2 h-4 w-4" />
                New Order
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate("/customer/orders")}>
            <CardHeader>
              <CardTitle>My Orders</CardTitle>
              <p className="text-sm text-muted-foreground">View your order history and receipts</p>
            </CardHeader>
            <CardContent>
              <Button className="w-full" variant="outline">
                <Receipt className="mr-2 h-4 w-4" />
                View Orders
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Your Password</DialogTitle>
            <DialogDescription>
              You are using the default password. Please change it for security.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
              <PasswordStrength password={newPassword} />
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
            <Button type="submit" className="w-full">
              Update Password
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      <Footer />
    </div>
  );
}
