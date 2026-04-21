import { useState, useEffect } from "react";
import { PageSkeleton } from "@/components/PageSkeleton";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { SubNav } from "@/components/SubNav";
import { BackButton } from "@/components/BackButton";
import { Footer } from "@/components/Footer";
import { NotificationBell } from "@/components/NotificationBell";
import { PaymentModal } from "@/components/PaymentModal";
import { PaymentHistory } from "@/components/PaymentHistory";
import { EditNotesDialog } from "@/components/EditNotesDialog";
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
import { Package, Trash2, Edit, FileText } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
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
  price_per_kg_at_time: number;
}

interface DeliveryWithPayments extends Delivery {
  paid_amount: number;
  due_amount: number;
  payment_state: "cleared" | "partial" | "unpaid";
}

export default function CustomerOrders() {
  const [user, setUser] = useState<any>(null);
  const [deliveries, setDeliveries] = useState<DeliveryWithPayments[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedDeliveryId, setSelectedDeliveryId] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedPaymentDelivery, setSelectedPaymentDelivery] = useState<{id: string, amount: number} | null>(null);
  const [editNotesOpen, setEditNotesOpen] = useState(false);
  const [editingNotesDelivery, setEditingNotesDelivery] = useState<Delivery | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications({ customerId: customerId || undefined });
  const isMobile = useIsMobile();

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
      .maybeSingle();

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
      .select("id, delivery_date, total_kg, total_charge, manual_adjustment, notes, status, price_per_kg_at_time")
      .eq("customer_id", customerId)
      .order("delivery_date", { ascending: false });

    if (!data) return;

    // Fetch payments allocated to these deliveries
    const ids = data.map((d) => d.id);
    const { data: payments } = ids.length
      ? await supabase
          .from("payments")
          .select("delivery_id, amount_paid")
          .eq("payment_status", "completed")
          .in("delivery_id", ids)
      : { data: [] as any[] };

    const paidMap: Record<string, number> = {};
    (payments || []).forEach((p: any) => {
      if (!p.delivery_id) return;
      paidMap[p.delivery_id] = (paidMap[p.delivery_id] || 0) + Number(p.amount_paid || 0);
    });

    const enriched: DeliveryWithPayments[] = data.map((d: any) => {
      const total = Number(d.total_charge || 0) + Number(d.manual_adjustment || 0);
      const paid = paidMap[d.id] || 0;
      const due = Math.max(total - paid, 0);
      const state: DeliveryWithPayments["payment_state"] =
        paid <= 0 ? "unpaid" : due <= 0.009 ? "cleared" : "partial";
      return { ...d, paid_amount: paid, due_amount: due, payment_state: state };
    });

    setDeliveries(enriched);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  if (loading || !user) return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <SubNav role="customer" />
      <div className="container py-8 flex-1"><PageSkeleton variant="list" /></div>
      <Footer />
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header user={user} onLogout={handleLogout}>
        <NotificationBell notifications={notifications} unreadCount={unreadCount} onMarkAsRead={markAsRead} onMarkAllAsRead={markAllAsRead} notificationsPage="/customer/notifications" />
      </Header>
      <SubNav role={user.role} />
      <main className="container mx-auto p-6 flex-1 pb-32">
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
            <CardTitle className="text-base md:text-xl">Delivery History</CardTitle>
            <CardDescription className="text-xs md:text-sm">All your gas deliveries</CardDescription>
          </CardHeader>
          <CardContent>
            {deliveries.length === 0 ? (
              <div className="text-center py-8">
                <Package className="mx-auto h-12 w-12 text-muted-foreground mb-2" />
                <p className="text-muted-foreground text-sm md:text-base">No deliveries yet</p>
              </div>
            ) : isMobile ? (
              <div className="space-y-3">
                {deliveries.map((delivery) => (
                  <Card key={delivery.id} className="border">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(delivery.delivery_date), "MMM dd, yyyy HH:mm")}
                          </p>
                          <p className="font-semibold text-base mt-1">
                            {delivery.total_kg.toFixed(2)} kg
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
                          {delivery.status === "en_route" ? "En Route" : delivery.status.charAt(0).toUpperCase() + delivery.status.slice(1)}
                        </Badge>
                      </div>

                      <div className="bg-muted p-2 rounded space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Price/kg:</span>
                          <span className="font-medium">KES {delivery.price_per_kg_at_time?.toFixed(2) || "-"}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Charge:</span>
                          <span className="font-medium">KES {delivery.total_charge.toFixed(2)}</span>
                        </div>
                        {delivery.manual_adjustment !== 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Adjustment:</span>
                            <span className="font-medium">KES {delivery.manual_adjustment.toFixed(2)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-sm border-t pt-1 mt-1">
                          <span className="text-muted-foreground">Paid:</span>
                          <span className="font-medium text-success">KES {delivery.paid_amount.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">
                            {delivery.payment_state === "cleared" ? "Status:" : "Outstanding:"}
                          </span>
                          <span className={`font-medium ${delivery.payment_state === "cleared" ? "text-success" : "text-destructive"}`}>
                            {delivery.payment_state === "cleared"
                              ? "Cleared"
                              : `KES ${delivery.due_amount.toFixed(2)}`}
                          </span>
                        </div>
                      </div>

                      {delivery.notes ? (
                        <div
                          className="bg-muted/50 p-2 rounded flex items-start gap-2 cursor-pointer hover:bg-muted transition-colors"
                          onClick={() => { setEditingNotesDelivery(delivery); setEditNotesOpen(true); }}
                        >
                          <FileText className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                          <p className="text-xs text-muted-foreground flex-1 truncate">
                            {delivery.notes}
                          </p>
                          <Edit className="h-3 w-3 text-muted-foreground flex-shrink-0 mt-0.5" />
                        </div>
                      ) : (
                        <button
                          className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                          onClick={() => { setEditingNotesDelivery(delivery); setEditNotesOpen(true); }}
                        >
                          <FileText className="h-3 w-3" />
                          Add a note...
                        </button>
                      )}

                      <div className="flex gap-2 pt-2">
                        {delivery.payment_state === "cleared" ? (
                          <Badge variant="default" className="flex-1 justify-center py-2 bg-success text-success-foreground">
                            Cleared
                          </Badge>
                        ) : (
                          <Button
                            variant="default"
                            size="sm"
                            className="flex-1"
                            onClick={() => {
                              setSelectedPaymentDelivery({
                                id: delivery.id,
                                amount: delivery.due_amount,
                              });
                              setPaymentModalOpen(true);
                            }}
                          >
                            {delivery.payment_state === "partial"
                              ? `Pay KES ${delivery.due_amount.toFixed(0)}`
                              : "Pay Now"}
                          </Button>
                        )}
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
                      <TableHead className="text-right">KG Delivered</TableHead>
                      <TableHead className="text-right">Price/kg</TableHead>
                      <TableHead className="text-right">Charge</TableHead>
                      <TableHead className="text-right">Adjustment</TableHead>
                      <TableHead className="text-right">Paid</TableHead>
                      <TableHead className="text-right">Due</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deliveries.map((delivery) => (
                      <TableRow key={delivery.id}>
                        <TableCell>
                          {format(new Date(delivery.delivery_date), "MMM dd, yyyy HH:mm")}
                        </TableCell>
                        <TableCell className="text-right">
                          {delivery.total_kg.toFixed(2)} kg
                        </TableCell>
                        <TableCell className="text-right">
                          KES {delivery.price_per_kg_at_time?.toFixed(2) || "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          KES {delivery.total_charge.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          {delivery.manual_adjustment !== 0
                            ? `KES ${delivery.manual_adjustment.toFixed(2)}`
                            : "-"}
                        </TableCell>
                        <TableCell className="text-right text-success font-medium">
                          KES {delivery.paid_amount.toFixed(2)}
                        </TableCell>
                        <TableCell className={`text-right font-medium ${delivery.payment_state === "cleared" ? "text-success" : "text-destructive"}`}>
                          {delivery.payment_state === "cleared" ? "Cleared" : `KES ${delivery.due_amount.toFixed(2)}`}
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
                        <TableCell className="max-w-xs">
                          <div
                            className="flex items-center gap-1 cursor-pointer hover:bg-muted p-1 rounded transition-colors"
                            onClick={() => { setEditingNotesDelivery(delivery); setEditNotesOpen(true); }}
                          >
                            <span className="text-xs text-muted-foreground truncate">
                              {delivery.notes || "Add note..."}
                            </span>
                            <Edit className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {delivery.payment_state === "cleared" ? (
                              <Badge variant="default" className="bg-success text-success-foreground">Cleared</Badge>
                            ) : (
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => {
                                  setSelectedPaymentDelivery({
                                    id: delivery.id,
                                    amount: delivery.due_amount,
                                  });
                                  setPaymentModalOpen(true);
                                }}
                              >
                                {delivery.payment_state === "partial"
                                  ? `Pay KES ${delivery.due_amount.toFixed(0)}`
                                  : "Pay Now"}
                              </Button>
                            )}
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
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment History */}
        <div className="mt-6">
          {customerId && <PaymentHistory customerId={customerId} isAdmin={false} />}
        </div>
      </main>

      {/* Static totals footer — sticks above main Footer, reflects current deliveries list */}
      {deliveries.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-30 border-t bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
          <div className="container mx-auto px-4 py-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Orders</p>
                <p className="text-base md:text-lg font-bold">{deliveries.length}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total Cost</p>
                <p className="text-base md:text-lg font-bold">
                  KES {deliveries.reduce((s, d) => s + Number(d.total_charge || 0) + Number(d.manual_adjustment || 0), 0).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Paid</p>
                <p className="text-base md:text-lg font-bold text-success">
                  KES {deliveries.reduce((s, d) => s + d.paid_amount, 0).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Outstanding</p>
                <p className="text-base md:text-lg font-bold text-destructive">
                  KES {deliveries.reduce((s, d) => s + d.due_amount, 0).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

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

      {editingNotesDelivery && (
        <EditNotesDialog
          open={editNotesOpen}
          onOpenChange={setEditNotesOpen}
          deliveryId={editingNotesDelivery.id}
          currentNotes={editingNotesDelivery.notes || ""}
          customerName="My Order"
          onSuccess={() => loadDeliveries(customerId!)}
        />
      )}
    </div>
  );
}
