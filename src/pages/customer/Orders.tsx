import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { SubNav } from "@/components/SubNav";
import { BackButton } from "@/components/BackButton";
import { Footer } from "@/components/Footer";
import { NotificationBell } from "@/components/NotificationBell";
import { PaymentModal } from "@/components/PaymentModal";
import { PaymentHistory } from "@/components/PaymentHistory";
import { useNotifications } from "@/hooks/useNotifications";
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
import { Package, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Delivery {
  id: string;
  delivery_date: string;
  total_kg: number;
  total_charge: number;
  manual_adjustment: number;
  notes: string;
  status: "pending" | "en_route" | "delivered";
}

export default function CustomerOrders() {
  const [user, setUser] = useState<any>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedDeliveryId, setSelectedDeliveryId] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedPaymentDelivery, setSelectedPaymentDelivery] = useState<{id: string, amount: number} | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { notifications } = useNotifications(customerId || undefined);

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
      setCustomerId(customerData.id);
      loadDeliveries(customerData.id);
    }
    
    setLoading(false);
  };

  const deleteDelivery = async () => {
    if (!selectedDeliveryId || !customerId) return;
    
    try {
      setLoading(true);
      
      // Get delivery details before deleting
      const { data: deliveryData, error: fetchError } = await supabase
        .from("deliveries")
        .select("total_charge, customer_id")
        .eq("id", selectedDeliveryId)
        .single();

      if (fetchError) throw fetchError;

      // Delete the delivery
      const { error: deleteError } = await supabase
        .from("deliveries")
        .delete()
        .eq("id", selectedDeliveryId);

      if (deleteError) throw deleteError;

      // Update customer arrears
      const { data: customerData, error: customerFetchError } = await supabase
        .from("customers")
        .select("arrears_balance")
        .eq("id", deliveryData.customer_id)
        .single();

      if (!customerFetchError && customerData) {
        await supabase
          .from("customers")
          .update({
            arrears_balance: (customerData.arrears_balance || 0) - deliveryData.total_charge,
          })
          .eq("id", deliveryData.customer_id);
      }

      toast({
        title: "Success",
        description: "Order reverted successfully!",
      });

      loadDeliveries(customerId);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setDeleteDialogOpen(false);
      setSelectedDeliveryId(null);
    }
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
    <div className="min-h-screen bg-background flex flex-col">
      <Header user={user} onLogout={handleLogout}>
        <NotificationBell notifications={notifications} />
      </Header>
      <SubNav role={user.role} />
      <main className="container mx-auto p-6 flex-1">
        <div className="mb-6">
          <BackButton />
        </div>
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
                  <TableHead>Status</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deliveries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
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
                      <TableCell>
                        <Badge
                          variant={
                            delivery.status === "delivered"
                              ? "default"
                              : delivery.status === "en_route"
                              ? "secondary"
                              : "outline"
                          }
                        >
                          {delivery.status === "en_route" ? "En Route" : delivery.status.charAt(0).toUpperCase() + delivery.status.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {delivery.notes || "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => {
                              setSelectedPaymentDelivery({
                                id: delivery.id,
                                amount: delivery.total_charge + (delivery.manual_adjustment || 0)
                              });
                              setPaymentModalOpen(true);
                            }}
                          >
                            Pay Now
                          </Button>
                          {delivery.status === "pending" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedDeliveryId(delivery.id);
                                setDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Payment History */}
        {customerId && <PaymentHistory customerId={customerId} isAdmin={false} />}
      </main>
      <Footer />

      {/* Payment Modal */}
      {selectedPaymentDelivery && (
        <PaymentModal
          open={paymentModalOpen}
          onOpenChange={setPaymentModalOpen}
          customerId={customerId!}
          deliveryId={selectedPaymentDelivery.id}
          amount={selectedPaymentDelivery.amount}
          onSuccess={() => {
            loadDeliveries(customerId!);
            setSelectedPaymentDelivery(null);
          }}
        />
      )}
      
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revert Order?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this pending order. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteDelivery}>
              Revert Order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
