import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { SubNav } from "@/components/SubNav";
import { BackButton } from "@/components/BackButton";
import { Footer } from "@/components/Footer";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Package, TrendingUp } from "lucide-react";
import { format } from "date-fns";

interface Delivery {
  id: string;
  delivery_date: string;
  total_kg: number;
  total_charge: number;
  manual_adjustment: number;
  notes: string;
  customer: {
    shop_name: string;
    in_charge_name: string;
  };
  delivery_items: Array<{
    quantity: number;
    kg_contribution: number;
    cylinder_capacities: {
      capacity_kg: number;
    };
  }>;
}

export default function OrderTracking() {
  const [user, setUser] = useState<any>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalOrders: 0,
    totalKg: 0,
    totalRevenue: 0,
  });
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkAuth();
    loadDeliveries();
  }, []);

  const checkAuth = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      navigate("/login");
      return;
    }

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .in("role", ["admin", "co_admin", "staff"])
      .single();

    if (!roleData) {
      navigate("/customer/dashboard");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .single();

    setUser({ ...profile, role: roleData.role, id: session.user.id });
    setLoading(false);
  };

  const loadDeliveries = async () => {
    const { data, error } = await supabase
      .from("deliveries")
      .select(
        `
        id,
        delivery_date,
        total_kg,
        total_charge,
        manual_adjustment,
        notes,
        customer:customers(shop_name, in_charge_name),
        delivery_items(
          quantity,
          kg_contribution,
          cylinder_capacities(capacity_kg)
        )
      `
      )
      .order("delivery_date", { ascending: false })
      .limit(100);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to load deliveries",
        variant: "destructive",
      });
      return;
    }

    if (data) {
      setDeliveries(data as any);
      
      // Calculate stats
      const totalOrders = data.length;
      const totalKg = data.reduce((sum, d) => sum + Number(d.total_kg), 0);
      const totalRevenue = data.reduce(
        (sum, d) => sum + Number(d.total_charge) + Number(d.manual_adjustment || 0),
        0
      );
      
      setStats({ totalOrders, totalKg, totalRevenue });
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  if (loading || !user) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header user={user} onLogout={handleLogout} />
      <SubNav role={user.role} />
      <main className="container mx-auto p-6 flex-1">
        <div className="mb-6">
          <BackButton />
        </div>

        <div className="mb-6">
          <h1 className="text-3xl font-bold">Order Tracking</h1>
          <p className="text-muted-foreground">
            Monitor all customer orders and deliveries
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalOrders}</div>
              <p className="text-xs text-muted-foreground">All-time orders</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Weight</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalKg.toFixed(2)} kg</div>
              <p className="text-xs text-muted-foreground">Gas delivered</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">
                KES {stats.totalRevenue.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">From deliveries</p>
            </CardContent>
          </Card>
        </div>

        {/* Orders Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Orders</CardTitle>
            <CardDescription>Complete order history with details</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead className="text-right">Weight (kg)</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deliveries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <Package className="mx-auto h-12 w-12 text-muted-foreground mb-2" />
                      <p className="text-muted-foreground">No orders yet</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  deliveries.map((delivery) => (
                    <TableRow key={delivery.id}>
                      <TableCell>
                        {format(new Date(delivery.delivery_date), "MMM dd, yyyy HH:mm")}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{delivery.customer.shop_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {delivery.customer.in_charge_name}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {delivery.delivery_items.map((item, idx) => (
                            <div key={idx} className="text-muted-foreground">
                              {item.quantity}x {item.cylinder_capacities.capacity_kg}kg
                            </div>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {delivery.total_kg.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div>
                          <p className="font-medium">
                            KES {delivery.total_charge.toLocaleString()}
                          </p>
                          {delivery.manual_adjustment !== 0 && (
                            <p className="text-xs text-muted-foreground">
                              Adj: {delivery.manual_adjustment > 0 ? "+" : ""}
                              {delivery.manual_adjustment}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="default">Delivered</Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
