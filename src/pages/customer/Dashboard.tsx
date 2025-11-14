import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Receipt, DollarSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function CustomerDashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [customer, setCustomer] = useState<any>(null);
  const [stats, setStats] = useState({
    recentDeliveries: 0,
    totalReceipts: 0,
    pendingBalance: 0,
  });

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  if (!user || !customer) return null;

  return (
    <div className="min-h-screen bg-background">
      <Header user={{ username: customer.username }} onLogout={handleLogout} />
      <div className="container py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">{customer.shop_name}</h1>
          <p className="text-muted-foreground">Welcome back, {customer.in_charge_name}</p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Deliveries</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.recentDeliveries}</div>
              <p className="text-xs text-muted-foreground">All-time deliveries</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Receipts</CardTitle>
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalReceipts}</div>
              <p className="text-xs text-muted-foreground">Available for download</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pending Balance</CardTitle>
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

        <div className="mt-8 text-center text-muted-foreground">
          <p>Customer features coming soon...</p>
          <p className="text-sm mt-2">View deliveries • Download receipts • Make payments</p>
        </div>
      </div>
    </div>
  );
}
