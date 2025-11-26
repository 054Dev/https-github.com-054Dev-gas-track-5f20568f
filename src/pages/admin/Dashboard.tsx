import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { SubNav } from "@/components/SubNav";
import { BackButton } from "@/components/BackButton";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Package, DollarSign, AlertCircle, Contact } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Footer } from "@/components/Footer";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [stats, setStats] = useState({
    totalCustomers: 0,
    todayDeliveries: 0,
    totalRevenue: 0,
    pendingBalance: 0,
  });

  useEffect(() => {
    checkAuth();
    loadStats();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/login");
      return;
    }

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (!roleData || (roleData.role !== "admin" && roleData.role !== "staff")) {
      toast({
        title: "Access Denied",
        description: "You don't have permission to access this page.",
        variant: "destructive",
      });
      navigate("/");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .single();

    setUser({ ...session.user, ...profile, role: roleData.role });
  };

  const loadStats = async () => {
    // Load dashboard statistics
    const { count: customersCount } = await supabase
      .from("customers")
      .select("*", { count: "exact", head: true })
      .is("deleted_at", null);

    const today = new Date().toISOString().split("T")[0];
    const { count: todayCount } = await supabase
      .from("deliveries")
      .select("*", { count: "exact", head: true })
      .gte("delivery_date", today);

    // Calculate total sales (profit) from all deliveries
    const { data: deliveriesData } = await supabase
      .from("deliveries")
      .select("total_charge, manual_adjustment");

    const totalRevenue = deliveriesData?.reduce(
      (sum, d) => sum + Number(d.total_charge) + Number(d.manual_adjustment || 0), 
      0
    ) || 0;

    const { data: arrearsData } = await supabase
      .from("customers")
      .select("arrears_balance");

    const pendingBalance = arrearsData?.reduce((sum, c) => sum + Number(c.arrears_balance), 0) || 0;

    setStats({
      totalCustomers: customersCount || 0,
      todayDeliveries: todayCount || 0,
      totalRevenue,
      pendingBalance,
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header user={user} onLogout={handleLogout} />
      <SubNav role={user.role} />
      <div className="container py-8 flex-1">
        <div className="mb-6">
          <BackButton />
        </div>
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground">Welcome back, {user.username}</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalCustomers}</div>
              <p className="text-xs text-muted-foreground">Active accounts</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Today's Deliveries</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.todayDeliveries}</div>
              <p className="text-xs text-muted-foreground">Deliveries logged today</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">KES {stats.totalRevenue.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Gross profit from all orders</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pending Balance</CardTitle>
              <AlertCircle className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">
                KES {stats.pendingBalance.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">Outstanding arrears</p>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle>Customer Management</CardTitle>
              <p className="text-sm text-muted-foreground">View and manage all customers</p>
            </CardHeader>
            <CardContent>
              <Button onClick={() => navigate("/admin/customers")} className="w-full">
                View Customers
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle>User Management</CardTitle>
              <p className="text-sm text-muted-foreground">Manage admins, staff, and customers</p>
            </CardHeader>
            <CardContent>
              <Button onClick={() => navigate("/admin/users")} className="w-full">
                Manage Users
              </Button>
            </CardContent>
          </Card>
          
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle>Services & Pricing</CardTitle>
              <p className="text-sm text-muted-foreground">Manage gas services and rates</p>
            </CardHeader>
            <CardContent>
              <Button onClick={() => navigate("/admin/services")} className="w-full">
                Manage Services
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle>Admin Contacts</CardTitle>
              <p className="text-sm text-muted-foreground">View and manage admin contacts</p>
            </CardHeader>
            <CardContent>
              <Button onClick={() => navigate("/admin/contacts")} className="w-full">
                View Contacts
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle>Deliveries</CardTitle>
              <p className="text-sm text-muted-foreground">Record and track deliveries</p>
            </CardHeader>
            <CardContent>
              <Button className="w-full" variant="outline" disabled>
                Coming Soon
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
      <Footer />
    </div>
  );
}
