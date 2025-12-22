import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { SubNav } from "@/components/SubNav";
import { BackButton } from "@/components/BackButton";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Package, DollarSign, AlertCircle, Eye, EyeOff, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Footer } from "@/components/Footer";
import { DebtsReportModal } from "@/components/DebtsReportModal";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [stats, setStats] = useState({
    totalCustomers: 0,
    todayDeliveries: 0,
    totalRevenue: 0,
    pendingBalance: 0,
    debtorsCount: 0,
  });
  const [hiddenCards, setHiddenCards] = useState<string[]>(() => {
    const saved = localStorage.getItem("adminHiddenCards");
    return saved ? JSON.parse(saved) : [];
  });
  const [showHidden, setShowHidden] = useState(false);
  const [debtsModalOpen, setDebtsModalOpen] = useState(false);

  const toggleCardVisibility = (cardId: string) => {
    const newHidden = hiddenCards.includes(cardId)
      ? hiddenCards.filter(id => id !== cardId)
      : [...hiddenCards, cardId];
    setHiddenCards(newHidden);
    localStorage.setItem("adminHiddenCards", JSON.stringify(newHidden));
  };

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

    // Calculate today's sales only
    const { data: deliveriesData } = await supabase
      .from("deliveries")
      .select("total_charge, manual_adjustment")
      .gte("delivery_date", today);

    const totalRevenue = deliveriesData?.reduce(
      (sum, d) => sum + Number(d.total_charge) + Number(d.manual_adjustment || 0), 
      0
    ) || 0;

    const { data: arrearsData } = await supabase
      .from("customers")
      .select("arrears_balance")
      .is("deleted_at", null);

    const pendingBalance = arrearsData?.reduce((sum, c) => sum + Number(c.arrears_balance), 0) || 0;
    const debtorsCount = arrearsData?.filter(c => Number(c.arrears_balance) > 0).length || 0;

    setStats({
      totalCustomers: customersCount || 0,
      todayDeliveries: todayCount || 0,
      totalRevenue,
      pendingBalance,
      debtorsCount,
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
      <div className="container py-4 md:py-8 px-4 md:px-6 flex-1">
        <div className="mb-4 md:mb-6">
          <BackButton />
        </div>
        <div className="mb-6 md:mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Admin Dashboard</h1>
            <p className="text-sm md:text-base text-muted-foreground">Welcome back, {user.username}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowHidden(!showHidden)}>
            {showHidden ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
            {showHidden ? "Hide" : "Show"} Hidden Cards
          </Button>
        </div>

        <div className="grid gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {(!hiddenCards.includes("customers") || showHidden) && (
            <Card className={hiddenCards.includes("customers") ? "opacity-50" : ""}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggleCardVisibility("customers")}>
                    {hiddenCards.includes("customers") ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                  </Button>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalCustomers}</div>
                <p className="text-xs text-muted-foreground">Active accounts</p>
              </CardContent>
            </Card>
          )}

          {(!hiddenCards.includes("deliveries") || showHidden) && (
            <Card className={hiddenCards.includes("deliveries") ? "opacity-50" : ""}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Today's Deliveries</CardTitle>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggleCardVisibility("deliveries")}>
                    {hiddenCards.includes("deliveries") ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                  </Button>
                  <Package className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.todayDeliveries}</div>
                <p className="text-xs text-muted-foreground">Deliveries logged today</p>
              </CardContent>
            </Card>
          )}

          {(!hiddenCards.includes("sales") || showHidden) && (
            <Card className={hiddenCards.includes("sales") ? "opacity-50" : ""}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Today's Sales</CardTitle>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggleCardVisibility("sales")}>
                    {hiddenCards.includes("sales") ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                  </Button>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">KES {stats.totalRevenue.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Today's revenue</p>
              </CardContent>
            </Card>
          )}

          {(!hiddenCards.includes("pending") || showHidden) && (
            <Card className={hiddenCards.includes("pending") ? "opacity-50" : ""}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Pending Balance</CardTitle>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggleCardVisibility("pending")}>
                    {hiddenCards.includes("pending") ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                  </Button>
                  <AlertCircle className="h-4 w-4 text-warning" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-warning">
                  KES {stats.pendingBalance.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">Outstanding arrears</p>
              </CardContent>
            </Card>
          )}

          {(!hiddenCards.includes("debts") || showHidden) && (
            <Card 
              className={`cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02] bg-gradient-to-br from-destructive/10 to-warning/10 border-destructive/30 ${hiddenCards.includes("debts") ? "opacity-50" : ""}`}
              onClick={() => setDebtsModalOpen(true)}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Customer Debts</CardTitle>
                <div className="flex gap-1">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6" 
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleCardVisibility("debts");
                    }}
                  >
                    {hiddenCards.includes("debts") ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                  </Button>
                  <TrendingUp className="h-4 w-4 text-destructive" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">
                  {stats.debtorsCount} customers
                </div>
                <p className="text-xs text-muted-foreground">Click to view detailed report</p>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="mt-6 md:mt-8 grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
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
              <CardTitle>Orders</CardTitle>
              <p className="text-sm text-muted-foreground">View and manage all orders</p>
            </CardHeader>
            <CardContent>
              <Button onClick={() => navigate("/admin/orders")} className="w-full">
                View Orders
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle>Create Delivery</CardTitle>
              <p className="text-sm text-muted-foreground">Record new delivery for customers</p>
            </CardHeader>
            <CardContent>
              <Button onClick={() => navigate("/admin/create-delivery")} className="w-full">
                Create Delivery
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle>Order Tracking</CardTitle>
              <p className="text-sm text-muted-foreground">Track all customer orders</p>
            </CardHeader>
            <CardContent>
              <Button onClick={() => navigate("/admin/order-tracking")} className="w-full" variant="outline">
                Track Orders
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
      <Footer />
      <DebtsReportModal open={debtsModalOpen} onOpenChange={setDebtsModalOpen} />
    </div>
  );
}
