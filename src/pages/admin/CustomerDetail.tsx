import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Header } from "@/components/Header";
import { SubNav } from "@/components/SubNav";
import { BackButton } from "@/components/BackButton";
import { Footer } from "@/components/Footer";
import { PaymentHistory } from "@/components/PaymentHistory";
import { CashPaymentModal } from "@/components/CashPaymentModal";
import { EditOrderPriceDialog } from "@/components/EditOrderPriceDialog";
import { useDeliveryLockStatus } from "@/hooks/useDeliveryLockStatus";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, MapPin, Phone, Mail, Edit, DollarSign } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Customer {
  id: string;
  shop_name: string;
  in_charge_name: string;
  phone: string;
  email: string;
  address: string;
  arrears_balance: number;
  price_per_kg: number;
}

interface Delivery {
  id: string;
  delivery_date: string;
  total_kg: number;
  total_charge: number;
  price_per_kg_at_time: number;
  manual_adjustment: number;
  status: "pending" | "en_route" | "delivered";
}

export default function CustomerDetail() {
  const { customerId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [showPricingDialog, setShowPricingDialog] = useState(false);
  const [showCashPaymentDialog, setShowCashPaymentDialog] = useState(false);
  const [newPrice, setNewPrice] = useState("");
  const [editPriceOpen, setEditPriceOpen] = useState(false);
  const [editingDelivery, setEditingDelivery] = useState<Delivery | null>(null);
  const [editLockStatus, setEditLockStatus] = useState({ isLocked: false, lockReason: "" });

  useEffect(() => {
    checkAuth();
    if (customerId) {
      loadCustomerData();
      loadDeliveries();
    }
  }, [customerId]);

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

    if (!roleData || (roleData.role !== "admin" && roleData.role !== "co_admin" && roleData.role !== "staff")) {
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

  const loadCustomerData = async () => {
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .eq("id", customerId)
      .single();

    if (error || !data) {
      toast({
        title: "Error",
        description: "Failed to load customer data",
        variant: "destructive",
      });
      navigate("/admin/customers");
      return;
    }

    setCustomer(data);
    setNewPrice(data.price_per_kg.toString());
  };

  const loadDeliveries = async () => {
    const { data, error } = await supabase
      .from("deliveries")
      .select("id, delivery_date, total_kg, total_charge, price_per_kg_at_time, manual_adjustment, status")
      .eq("customer_id", customerId)
      .order("delivery_date", { ascending: false });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to load deliveries",
        variant: "destructive",
      });
      return;
    }

    setDeliveries(data || []);
    
    // Calculate total earnings
    const total = data?.reduce((sum, d) => sum + Number(d.total_charge) + Number(d.manual_adjustment || 0), 0) || 0;
    setTotalEarnings(total);
  };

  const handleUpdatePricing = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { error } = await supabase
        .from("customers")
        .update({ price_per_kg: parseFloat(newPrice) })
        .eq("id", customerId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Pricing updated successfully",
      });

      setShowPricingDialog(false);
      loadCustomerData();
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

  const { checkLockStatus } = useDeliveryLockStatus();

  const handleEditDeliveryPrice = async (delivery: Delivery) => {
    const status = await checkLockStatus(delivery.id, delivery.status);
    setEditLockStatus(status);
    setEditingDelivery(delivery);
    setEditPriceOpen(true);
  };

  if (!user || !customer) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header user={user} onLogout={handleLogout} />
      <SubNav role={user.role} />
      <div className="container py-4 md:py-8 px-4 md:px-6 flex-1">
        <div className="mb-4 md:mb-6">
          <BackButton />
        </div>

        {/* Customer Header */}
        <Card className="mb-4 md:mb-6">
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
              <div>
                <CardTitle className="text-xl md:text-2xl mb-2">{customer.shop_name}</CardTitle>
                <p className="text-sm md:text-base text-muted-foreground">{customer.in_charge_name}</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                {user.role === "admin" && (
                  <>
                    <Button onClick={() => setShowPricingDialog(true)} variant="outline" className="w-full sm:w-auto">
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Pricing
                    </Button>
                    <Button onClick={() => setShowCashPaymentDialog(true)} className="w-full sm:w-auto">
                      <DollarSign className="h-4 w-4 mr-2" />
                      Record Cash Payment
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div className="space-y-2 md:space-y-3">
                <div className="flex items-center gap-2">
                  <MapPin className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-xs md:text-sm">{customer.address || "No address provided"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-xs md:text-sm">{customer.phone}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-xs md:text-sm break-all">{customer.email}</span>
                </div>
              </div>
              <div className="space-y-2 md:space-y-3">
                <div className="bg-muted p-2 md:p-3 rounded-md">
                  <p className="text-xs md:text-sm text-muted-foreground">Price per KG</p>
                  <p className="text-lg md:text-xl font-bold">KES {customer.price_per_kg}</p>
                </div>
                {customer.arrears_balance > 0 && (
                  <div className="bg-warning/10 p-2 md:p-3 rounded-md">
                    <p className="text-xs md:text-sm text-warning font-medium">Pending Arrears</p>
                    <p className="text-lg md:text-xl font-bold text-warning">
                      KES {customer.arrears_balance.toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4 md:mb-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm md:text-base font-medium">Total Deliveries</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl md:text-2xl font-bold">{deliveries.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm md:text-base font-medium">Total Earnings</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl md:text-2xl font-bold text-success">
                KES {totalEarnings.toLocaleString()}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm md:text-base font-medium">Outstanding Balance</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl md:text-2xl font-bold text-warning">
                KES {customer.arrears_balance.toLocaleString()}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Transactions Table */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg md:text-xl">Transaction History</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {deliveries.length > 0 ? (
              <div className="min-w-[700px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs md:text-sm">Date</TableHead>
                      <TableHead className="text-xs md:text-sm">Quantity (KG)</TableHead>
                      <TableHead className="text-xs md:text-sm">Price/KG</TableHead>
                      <TableHead className="text-xs md:text-sm">Base Charge</TableHead>
                      <TableHead className="text-xs md:text-sm">Adjustment</TableHead>
                      <TableHead className="text-right text-xs md:text-sm">Total</TableHead>
                      <TableHead className="text-xs md:text-sm">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deliveries.map((delivery) => (
                      <TableRow key={delivery.id}>
                        <TableCell className="text-xs md:text-sm">
                          {new Date(delivery.delivery_date).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-xs md:text-sm">{delivery.total_kg} KG</TableCell>
                        <TableCell className="text-xs md:text-sm">KES {delivery.price_per_kg_at_time}</TableCell>
                        <TableCell className="text-xs md:text-sm">KES {Number(delivery.total_charge).toLocaleString()}</TableCell>
                        <TableCell className="text-xs md:text-sm">
                          {delivery.manual_adjustment !== 0 && (
                            <span className={delivery.manual_adjustment > 0 ? "text-success" : "text-warning"}>
                              {delivery.manual_adjustment > 0 ? "+" : ""}
                              KES {Number(delivery.manual_adjustment).toLocaleString()}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium text-xs md:text-sm">
                          KES {(Number(delivery.total_charge) + Number(delivery.manual_adjustment || 0)).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditDeliveryPrice(delivery)}
                          >
                            <Edit className="h-3 w-3 md:h-4 md:w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8 text-sm md:text-base">No transactions yet</p>
            )}
          </CardContent>
        </Card>

        {/* Payment History - Import component */}
        <PaymentHistory customerId={customerId!} isAdmin={true} />
      </div>
      <Footer />

      {/* Edit Pricing Dialog */}
      <Dialog open={showPricingDialog} onOpenChange={setShowPricingDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Customer Pricing</DialogTitle>
            <DialogDescription>
              Update the price per KG for {customer.shop_name}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdatePricing} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="price">Price per KG (KES)</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full">
              Update Pricing
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Cash Payment Dialog */}
      <CashPaymentModal
        open={showCashPaymentDialog}
        onOpenChange={setShowCashPaymentDialog}
        customerId={customerId!}
        onSuccess={() => {
          loadCustomerData();
        }}
      />

      {/* Edit Order Price Dialog */}
      {editingDelivery && (
        <EditOrderPriceDialog
          open={editPriceOpen}
          onOpenChange={setEditPriceOpen}
          deliveryId={editingDelivery.id}
          customerId={customerId!}
          currentPricePerKg={editingDelivery.price_per_kg_at_time}
          totalKg={editingDelivery.total_kg}
          currentTotalCharge={editingDelivery.total_charge}
          onSuccess={() => {
            loadDeliveries();
            loadCustomerData();
          }}
          isLocked={editLockStatus.isLocked}
          lockReason={editLockStatus.lockReason}
        />
      )}
    </div>
  );
}