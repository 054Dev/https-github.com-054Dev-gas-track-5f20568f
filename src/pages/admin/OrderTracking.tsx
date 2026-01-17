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
import { Package, TrendingUp, DollarSign, Edit, Lock } from "lucide-react";
import { format } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CashPaymentModal } from "@/components/CashPaymentModal";
import { EditOrderPriceDialog } from "@/components/EditOrderPriceDialog";
import { useDeliveryLockStatus } from "@/hooks/useDeliveryLockStatus";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Delivery {
  id: string;
  delivery_date: string;
  total_kg: number;
  total_charge: number;
  price_per_kg_at_time: number;
  manual_adjustment: number;
  notes: string;
  status: "pending" | "en_route" | "delivered";
  customer_id: string;
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
  const [cashPaymentOpen, setCashPaymentOpen] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);
  const [editPriceOpen, setEditPriceOpen] = useState(false);
  const [editingDelivery, setEditingDelivery] = useState<Delivery | null>(null);
  const [editLockStatus, setEditLockStatus] = useState({ isLocked: false, lockReason: "" });
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { checkLockStatus } = useDeliveryLockStatus();

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
        price_per_kg_at_time,
        manual_adjustment,
        notes,
        status,
        customer_id,
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

  const updateStatus = async (deliveryId: string, newStatus: "pending" | "en_route" | "delivered") => {
    try {
      const { error } = await supabase
        .from("deliveries")
        .update({ status: newStatus })
        .eq("id", deliveryId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Order status updated!",
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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const handleRecordPayment = (delivery: Delivery) => {
    setSelectedDelivery(delivery);
    setCashPaymentOpen(true);
  };

  const handleEditPrice = async (delivery: Delivery) => {
    const status = await checkLockStatus(delivery.id, delivery.status);
    setEditLockStatus(status);
    setEditingDelivery(delivery);
    setEditPriceOpen(true);
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
            <CardTitle className="text-base md:text-xl">All Orders</CardTitle>
            <CardDescription className="text-xs md:text-sm">Complete order history with details</CardDescription>
          </CardHeader>
          <CardContent>
            {deliveries.length === 0 ? (
              <div className="text-center py-8">
                <Package className="mx-auto h-12 w-12 text-muted-foreground mb-2" />
                <p className="text-muted-foreground text-sm md:text-base">No orders yet</p>
              </div>
            ) : isMobile ? (
              <div className="space-y-3">
                {deliveries.map((delivery) => (
                  <Card key={delivery.id} className="border">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold">{delivery.customer.shop_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {delivery.customer.in_charge_name}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(delivery.delivery_date), "MMM dd, yyyy HH:mm")}
                          </p>
                        </div>
                        <Badge
                          variant={
                            delivery.status === "delivered"
                              ? "default"
                              : delivery.status === "en_route"
                              ? "secondary"
                              : "outline"
                          }
                        >
                          {delivery.status === "en_route" ? "En Route" : delivery.status}
                        </Badge>
                      </div>

                      <div className="bg-muted p-2 rounded space-y-1">
                        <div className="text-xs space-y-1">
                          {delivery.delivery_items.map((item, idx) => (
                            <div key={idx} className="flex justify-between">
                              <span className="text-muted-foreground">
                                {item.quantity}x {item.cylinder_capacities.capacity_kg}kg
                              </span>
                              <span>{item.kg_contribution.toFixed(2)} kg</span>
                            </div>
                          ))}
                        </div>
                        <div className="border-t pt-1 mt-2 flex justify-between font-semibold text-sm">
                          <span>Total:</span>
                          <span>{delivery.total_kg.toFixed(2)} kg</span>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 pt-2">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="text-lg font-bold text-primary">
                              KES {delivery.total_charge.toLocaleString()}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              @ KES {delivery.price_per_kg_at_time}/kg
                            </p>
                            {delivery.manual_adjustment !== 0 && (
                              <p className="text-xs text-muted-foreground">
                                Adj: {delivery.manual_adjustment > 0 ? "+" : ""}
                                {delivery.manual_adjustment}
                              </p>
                            )}
                          </div>
                          <Select
                            value={delivery.status}
                            onValueChange={(value) => updateStatus(delivery.id, value as "pending" | "en_route" | "delivered")}
                          >
                            <SelectTrigger className="w-[120px] h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-card z-50">
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="en_route">En Route</SelectItem>
                              <SelectItem value="delivered">Delivered</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditPrice(delivery)}
                          >
                            <Edit className="mr-2 h-4 w-4" />
                            Edit Price
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRecordPayment(delivery)}
                          >
                            <DollarSign className="mr-2 h-4 w-4" />
                            Payment
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead className="text-right">Weight (kg)</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deliveries.map((delivery) => (
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
                            <p className="text-xs text-muted-foreground">
                              @ KES {delivery.price_per_kg_at_time}/kg
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
                          <Select
                            value={delivery.status}
                            onValueChange={(value) => updateStatus(delivery.id, value as "pending" | "en_route" | "delivered")}
                          >
                            <SelectTrigger className="w-[130px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-card z-50">
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="en_route">En Route</SelectItem>
                              <SelectItem value="delivered">Delivered</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditPrice(delivery)}
                            >
                              <Edit className="mr-1 h-4 w-4" />
                              Price
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRecordPayment(delivery)}
                            >
                              <DollarSign className="mr-1 h-4 w-4" />
                              Payment
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
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

        {editingDelivery && (
          <EditOrderPriceDialog
            open={editPriceOpen}
            onOpenChange={setEditPriceOpen}
            deliveryId={editingDelivery.id}
            customerId={editingDelivery.customer_id}
            currentPricePerKg={editingDelivery.price_per_kg_at_time}
            totalKg={editingDelivery.total_kg}
            currentTotalCharge={editingDelivery.total_charge}
            onSuccess={loadDeliveries}
            isLocked={editLockStatus.isLocked}
            lockReason={editLockStatus.lockReason}
          />
        )}
      </main>
      <Footer />
    </div>
  );
}
