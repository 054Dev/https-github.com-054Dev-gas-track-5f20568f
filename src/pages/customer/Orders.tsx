import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { SubNav } from "@/components/SubNav";
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
import { Package } from "lucide-react";
import { format } from "date-fns";

interface Delivery {
  id: string;
  delivery_date: string;
  total_kg: number;
  total_charge: number;
  manual_adjustment: number;
  notes: string;
}

export default function CustomerOrders() {
  const [user, setUser] = useState<any>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth();
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
      .eq("role", "customer")
      .single();

    if (!roleData) {
      navigate("/admin/dashboard");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .single();

    setUser({ ...profile, role: roleData.role });
    
    // Get customer data
    const { data: customerData } = await supabase
      .from("customers")
      .select("id")
      .eq("user_id", session.user.id)
      .single();

    if (customerData) {
      loadDeliveries(customerData.id);
    }
    
    setLoading(false);
  };

  const loadDeliveries = async (customerId: string) => {
    const { data } = await supabase
      .from("deliveries")
      .select("*")
      .eq("customer_id", customerId)
      .order("delivery_date", { ascending: false });

    if (data) setDeliveries(data);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  if (loading || !user) return null;

  return (
    <div className="min-h-screen bg-background">
      <Header user={user} onLogout={handleLogout} />
      <SubNav role={user.role} />
      <main className="container mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">My Orders</h1>
          <p className="text-muted-foreground">
            View your delivery history and charges
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Delivery History</CardTitle>
            <CardDescription>All your gas deliveries</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">KG Delivered</TableHead>
                  <TableHead className="text-right">Charge</TableHead>
                  <TableHead className="text-right">Adjustment</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deliveries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <Package className="mx-auto h-12 w-12 text-muted-foreground mb-2" />
                      <p className="text-muted-foreground">No deliveries yet</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  deliveries.map((delivery) => (
                    <TableRow key={delivery.id}>
                      <TableCell>
                        {format(new Date(delivery.delivery_date), "MMM dd, yyyy HH:mm")}
                      </TableCell>
                      <TableCell className="text-right">
                        {delivery.total_kg.toFixed(2)} kg
                      </TableCell>
                      <TableCell className="text-right">
                        KES {delivery.total_charge.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        {delivery.manual_adjustment !== 0
                          ? `KES ${delivery.manual_adjustment.toFixed(2)}`
                          : "-"}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {delivery.notes || "-"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
