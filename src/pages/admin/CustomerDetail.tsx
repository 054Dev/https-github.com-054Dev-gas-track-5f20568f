import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, MapPin, Phone, Mail, Edit } from "lucide-react";
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
  manual_adjustment: number;
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
  const [newPrice, setNewPrice] = useState("");

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
      .select("*")
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

  if (!user || !customer) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header user={user} onLogout={handleLogout} />
      <div className="container py-8 flex-1">
        <Button
          variant="ghost"
          onClick={() => navigate("/admin/customers")}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Customers
        </Button>

        {/* Customer Header */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-2xl mb-2">{customer.shop_name}</CardTitle>
                <p className="text-muted-foreground">{customer.in_charge_name}</p>
              </div>
              {user.role === "admin" && (
                <Button onClick={() => setShowPricingDialog(true)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Pricing
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{customer.address || "No address provided"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{customer.phone}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{customer.email}</span>
                </div>
              </div>
              <div className="space-y-3">
                <div className="bg-muted p-3 rounded-md">
                  <p className="text-sm text-muted-foreground">Price per KG</p>
                  <p className="text-xl font-bold">KES {customer.price_per_kg}</p>
                </div>
                {customer.arrears_balance > 0 && (
                  <div className="bg-warning/10 p-3 rounded-md">
                    <p className="text-sm text-warning font-medium">Pending Arrears</p>
                    <p className="text-xl font-bold text-warning">
                      KES {customer.arrears_balance.toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Total Deliveries</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{deliveries.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-success">
                KES {totalEarnings.toLocaleString()}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Outstanding Balance</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-warning">
                KES {customer.arrears_balance.toLocaleString()}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Transactions Table */}
        <Card>
          <CardHeader>
            <CardTitle>Transaction History</CardTitle>
          </CardHeader>
          <CardContent>
            {deliveries.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Quantity (KG)</TableHead>
                    <TableHead>Base Charge</TableHead>
                    <TableHead>Adjustment</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deliveries.map((delivery) => (
                    <TableRow key={delivery.id}>
                      <TableCell>
                        {new Date(delivery.delivery_date).toLocaleDateString()}
                      </TableCell>
                      <TableCell>{delivery.total_kg} KG</TableCell>
                      <TableCell>KES {Number(delivery.total_charge).toLocaleString()}</TableCell>
                      <TableCell>
                        {delivery.manual_adjustment !== 0 && (
                          <span className={delivery.manual_adjustment > 0 ? "text-success" : "text-warning"}>
                            {delivery.manual_adjustment > 0 ? "+" : ""}
                            KES {Number(delivery.manual_adjustment).toLocaleString()}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        KES {(Number(delivery.total_charge) + Number(delivery.manual_adjustment || 0)).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-center text-muted-foreground py-8">No transactions yet</p>
            )}
          </CardContent>
        </Card>
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
    </div>
  );
}