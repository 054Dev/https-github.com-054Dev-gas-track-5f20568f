import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { SubNav } from "@/components/SubNav";
import { BackButton } from "@/components/BackButton";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus, Package, DollarSign } from "lucide-react";
import { format } from "date-fns";
import { CashPaymentModal } from "@/components/CashPaymentModal";

interface Customer {
  id: string;
  shop_name: string;
  price_per_kg: number;
}

interface Delivery {
  id: string;
  delivery_date: string;
  total_kg: number;
  total_charge: number;
  manual_adjustment: number;
  notes: string;
  status: "pending" | "en_route" | "delivered";
  customer_id: string;
  customer: {
    shop_name: string;
  };
}

export default function Orders() {
  const [user, setUser] = useState<any>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [cashPaymentOpen, setCashPaymentOpen] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);
  const [newDelivery, setNewDelivery] = useState({
    customer_id: "",
    total_kg: "",
    manual_adjustment: "0",
    notes: "",
  });
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkAuth();
    loadCustomers();
    loadDeliveries();
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

  const loadCustomers = async () => {
    const { data } = await supabase
      .from("customers")
      .select("id, shop_name, price_per_kg")
      .is("deleted_at", null)
      .eq("status", "active")
      .order("shop_name");

    if (data) setCustomers(data);
  };

  const loadDeliveries = async () => {
    const { data } = await supabase
      .from("deliveries")
      .select(`
        id,
        delivery_date,
        total_kg,
        total_charge,
        manual_adjustment,
        notes,
        status,
        customer_id,
        customer:customers(shop_name)
      `)
      .order("delivery_date", { ascending: false })
      .limit(50);

    if (data) setDeliveries(data as any);
  };

  const updateStatus = async (deliveryId: string, newStatus: "pending" | "en_route" | "delivered") => {
    try {
      // Get delivery details first
      const delivery = deliveries.find(d => d.id === deliveryId);
      if (!delivery) throw new Error("Delivery not found");

      const { error } = await supabase
        .from("deliveries")
        .update({ status: newStatus })
        .eq("id", deliveryId);

      if (error) throw error;

      // Send notification only when status changes to en_route or delivered
      if (newStatus === "en_route" || newStatus === "delivered") {
        const { data: deliveryData } = await supabase
          .from("deliveries")
          .select("customer_id")
          .eq("id", deliveryId)
          .single();

        if (deliveryData) {
          const statusMessage = newStatus === "en_route" 
            ? "Your order is now en route and will arrive soon!"
            : "Your order has been delivered successfully!";

          // Call edge function to send notifications
          const { error: notificationError } = await supabase.functions.invoke(
            "send-notification",
            {
              body: {
                customerId: deliveryData.customer_id,
                message: statusMessage,
                type: "order_status",
                status: newStatus,
              },
            }
          );

          if (notificationError) {
            console.error("Failed to send notification:", notificationError);
          }
        }
      }

      toast({
        title: "Success",
        description: "Order status updated and notifications sent!",
      });

      loadDeliveries();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const createDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const customer = customers.find(c => c.id === newDelivery.customer_id);
      if (!customer) throw new Error("Customer not found");

      const totalKg = parseFloat(newDelivery.total_kg);
      const manualAdjustment = parseFloat(newDelivery.manual_adjustment);
      const totalCharge = (totalKg * customer.price_per_kg) + manualAdjustment;

      const { error } = await supabase.from("deliveries").insert({
        customer_id: newDelivery.customer_id,
        logged_by_user_id: user.id,
        total_kg: totalKg,
        price_per_kg_at_time: customer.price_per_kg,
        total_charge: totalCharge,
        manual_adjustment: manualAdjustment,
        notes: newDelivery.notes,
      });

      if (error) throw error;

      // Update customer arrears
      const { data: customerData } = await supabase
        .from("customers")
        .select("arrears_balance")
        .eq("id", newDelivery.customer_id)
        .single();

      if (customerData) {
        const { error: updateError } = await supabase
          .from("customers")
          .update({
            arrears_balance: (customerData.arrears_balance || 0) + totalCharge,
          })
          .eq("id", newDelivery.customer_id);

        if (updateError) throw updateError;
      }

      toast({
        title: "Success",
        description: "Delivery logged successfully!",
      });

      setDialogOpen(false);
      setNewDelivery({
        customer_id: "",
        total_kg: "",
        manual_adjustment: "0",
        notes: "",
      });
      loadDeliveries();
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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const handleRecordPayment = (delivery: Delivery) => {
    setSelectedDelivery(delivery);
    setCashPaymentOpen(true);
  };

  if (loading || !user) return null;

  return (
    <div className="min-h-screen bg-background">
      <Header user={user} onLogout={handleLogout} />
      <SubNav role={user.role} />
      <main className="container mx-auto p-4 md:p-6">
        <div className="mb-4 md:mb-6">
          <BackButton />
        </div>
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-4 md:mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Order Management</h1>
            <p className="text-sm md:text-base text-muted-foreground">
              Track and log customer deliveries
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full md:w-auto">
                <Plus className="mr-2 h-4 w-4" />
                Log Delivery
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[95vw] max-w-md mx-auto">
              <DialogHeader>
                <DialogTitle className="text-lg md:text-xl">Log New Delivery</DialogTitle>
                <DialogDescription className="text-xs md:text-sm">
                  Record a new gas delivery to a customer
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={createDelivery} className="space-y-3 md:space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="customer">Customer</Label>
                  <Select
                    value={newDelivery.customer_id}
                    onValueChange={(value) =>
                      setNewDelivery({ ...newDelivery, customer_id: value })
                    }
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select customer" />
                    </SelectTrigger>
                    <SelectContent className="bg-card z-50">
                      {customers.map((customer) => (
                        <SelectItem key={customer.id} value={customer.id}>
                          {customer.shop_name} - KES {customer.price_per_kg}/kg
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="total_kg">Total KG</Label>
                  <Input
                    id="total_kg"
                    type="number"
                    step="0.01"
                    value={newDelivery.total_kg}
                    onChange={(e) =>
                      setNewDelivery({ ...newDelivery, total_kg: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="adjustment">Manual Adjustment (KES)</Label>
                  <Input
                    id="adjustment"
                    type="number"
                    step="0.01"
                    value={newDelivery.manual_adjustment}
                    onChange={(e) =>
                      setNewDelivery({
                        ...newDelivery,
                        manual_adjustment: e.target.value,
                      })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Add extra charges or discounts
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={newDelivery.notes}
                    onChange={(e) =>
                      setNewDelivery({ ...newDelivery, notes: e.target.value })
                    }
                    placeholder="Optional delivery notes"
                  />
                </div>
                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? "Logging..." : "Log Delivery"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg md:text-xl">Recent Deliveries</CardTitle>
            <CardDescription className="text-xs md:text-sm">Last 50 deliveries</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <div className="min-w-[600px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs md:text-sm">Date</TableHead>
                    <TableHead className="text-xs md:text-sm">Customer</TableHead>
                    <TableHead className="text-right text-xs md:text-sm">KG</TableHead>
                    <TableHead className="text-right text-xs md:text-sm">Charge</TableHead>
                    <TableHead className="text-right text-xs md:text-sm">Adjustment</TableHead>
                    <TableHead className="text-xs md:text-sm">Status</TableHead>
                    <TableHead className="text-xs md:text-sm">Notes</TableHead>
                    <TableHead className="text-xs md:text-sm">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deliveries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8">
                        <Package className="mx-auto h-8 w-8 md:h-12 md:w-12 text-muted-foreground mb-2" />
                        <p className="text-sm md:text-base text-muted-foreground">No deliveries logged yet</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    deliveries.map((delivery) => (
                      <TableRow key={delivery.id}>
                        <TableCell className="text-xs md:text-sm">
                          {format(new Date(delivery.delivery_date), "MMM dd, yyyy")}
                        </TableCell>
                        <TableCell className="text-xs md:text-sm">{delivery.customer.shop_name}</TableCell>
                        <TableCell className="text-right text-xs md:text-sm">
                          {delivery.total_kg.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right text-xs md:text-sm">
                          KES {delivery.total_charge.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right text-xs md:text-sm">
                          {delivery.manual_adjustment !== 0
                            ? `KES ${delivery.manual_adjustment.toFixed(2)}`
                            : "-"}
                        </TableCell>
                        <TableCell className="text-xs md:text-sm">
                          <Select
                            value={delivery.status}
                            onValueChange={(value) => updateStatus(delivery.id, value as "pending" | "en_route" | "delivered")}
                          >
                            <SelectTrigger className="w-[130px] h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-card z-50">
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="en_route">En Route</SelectItem>
                              <SelectItem value="delivered">Delivered</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="max-w-xs truncate text-xs md:text-sm">
                          {delivery.notes || "-"}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRecordPayment(delivery)}
                          >
                            <DollarSign className="mr-2 h-4 w-4" />
                            Record Payment
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {selectedDelivery && (
          <CashPaymentModal
            open={cashPaymentOpen}
            onOpenChange={setCashPaymentOpen}
            customerId={selectedDelivery.customer_id}
            deliveryId={selectedDelivery.id}
            onSuccess={loadDeliveries}
          />
        )}
      </main>
      <Footer />
    </div>
  );
}
