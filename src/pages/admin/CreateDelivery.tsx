import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { SubNav } from "@/components/SubNav";
import { BackButton } from "@/components/BackButton";
import { Footer } from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Package, Plus, Minus } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

interface CylinderCapacity {
  id: string;
  capacity_kg: number;
}

interface Customer {
  id: string;
  shop_name: string;
  in_charge_name: string;
  price_per_kg: number;
  arrears_balance: number;
}

interface OrderItem {
  cylinder_capacity_id: string;
  capacity_kg: number;
  quantity: number;
  kg_contribution: number;
}

export default function CreateDelivery() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [cylinders, setCylinders] = useState<CylinderCapacity[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [notes, setNotes] = useState("");
  const [manualAdjustment, setManualAdjustment] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

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
      .in("role", ["admin", "co_admin", "staff"])
      .maybeSingle();

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
    await loadCustomers();
    await loadCylinders();
    setLoading(false);
  };

  const loadCustomers = async () => {
    const { data } = await supabase
      .from("customers")
      .select("*")
      .eq("status", "active")
      .order("shop_name", { ascending: true });

    if (data) {
      setCustomers(data);
    }
  };

  const loadCylinders = async () => {
    const { data } = await supabase
      .from("cylinder_capacities")
      .select("*")
      .order("capacity_kg", { ascending: true });

    if (data) {
      setCylinders(data);
      setOrderItems(
        data.map((c) => ({
          cylinder_capacity_id: c.id,
          capacity_kg: c.capacity_kg,
          quantity: 0,
          kg_contribution: 0,
        }))
      );
    }
  };

  const updateQuantity = (cylinderId: string, change: number) => {
    setOrderItems((prev) =>
      prev.map((item) =>
        item.cylinder_capacity_id === cylinderId
          ? {
              ...item,
              quantity: Math.max(0, item.quantity + change),
              kg_contribution: Math.max(0, item.quantity + change) * item.capacity_kg,
            }
          : item
      )
    );
  };

  const totalKg = orderItems.reduce((sum, item) => sum + item.kg_contribution, 0);
  const totalBill = totalKg * (selectedCustomer?.price_per_kg || 0);
  const finalAmount = totalBill + manualAdjustment;

  const handleSubmitDelivery = async () => {
    if (!selectedCustomer) {
      toast({
        title: "Error",
        description: "Please select a customer",
        variant: "destructive",
      });
      return;
    }

    if (totalKg === 0) {
      toast({
        title: "Error",
        description: "Please add at least one cylinder to the delivery",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const { data: deliveryData, error: deliveryError } = await supabase
        .from("deliveries")
        .insert({
          customer_id: selectedCustomer.id,
          logged_by_user_id: user.id,
          total_kg: totalKg,
          price_per_kg_at_time: selectedCustomer.price_per_kg,
          total_charge: totalBill,
          notes: notes || null,
          manual_adjustment: manualAdjustment,
        })
        .select()
        .single();

      if (deliveryError) throw deliveryError;

      const itemsToInsert = orderItems
        .filter((item) => item.quantity > 0)
        .map((item) => ({
          delivery_id: deliveryData.id,
          cylinder_capacity_id: item.cylinder_capacity_id,
          quantity: item.quantity,
          kg_contribution: item.kg_contribution,
        }));

      if (itemsToInsert.length > 0) {
        const { error: itemsError } = await supabase
          .from("delivery_items")
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;
      }

      const newBalance = (selectedCustomer.arrears_balance || 0) + finalAmount;
      const { error: updateError } = await supabase
        .from("customers")
        .update({ arrears_balance: newBalance })
        .eq("id", selectedCustomer.id);

      if (updateError) throw updateError;

      // Auto-bill from overpayment credit if customer has a credit balance
      if ((selectedCustomer.arrears_balance || 0) < 0) {
        try {
          await supabase.functions.invoke("intasend-payment", {
            body: {
              action: "overpayment-billing",
              customerId: selectedCustomer.id,
              deliveryId: deliveryData.id,
            },
          });
        } catch (overpayErr) {
          console.error("Overpayment billing error:", overpayErr);
          // Non-fatal: delivery already created
        }
      }

      toast({
        title: "Success",
        description: "Delivery created successfully",
      });

      navigate("/admin/order-tracking");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
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

        <div className="mb-8">
          <h1 className="text-3xl font-bold">Create Delivery</h1>
          <p className="text-muted-foreground">Record a new gas delivery for a customer</p>
        </div>

        <div className="mb-6">
          <Card>
            <CardHeader>
              <CardTitle>Select Customer</CardTitle>
            </CardHeader>
            <CardContent>
              <Select
                value={selectedCustomer?.id}
                onValueChange={(value) => {
                  const customer = customers.find((c) => c.id === value);
                  setSelectedCustomer(customer || null);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a customer..." />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.shop_name} - {customer.in_charge_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedCustomer && (
                <div className="mt-4 p-4 bg-muted rounded-lg space-y-2">
                  <p className="text-sm">
                    <span className="font-medium">Price per kg:</span> KES{" "}
                    {selectedCustomer.price_per_kg}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">Current Balance:</span> KES{" "}
                    {selectedCustomer.arrears_balance.toLocaleString()}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {selectedCustomer && (
          <>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
              {orderItems.map((item) => (
                <Card key={item.cylinder_capacity_id}>
                  <CardHeader>
                    <CardTitle>{item.capacity_kg}kg Cylinder</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => updateQuantity(item.cylinder_capacity_id, -1)}
                        disabled={item.quantity === 0}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="text-2xl font-bold">{item.quantity}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => updateQuantity(item.cylinder_capacity_id, 1)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Total Weight</p>
                      <p className="text-xl font-semibold">{item.kg_contribution} kg</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid gap-4 md:grid-cols-2 mb-8">
              <Card>
                <CardHeader>
                  <CardTitle>Delivery Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between text-lg">
                    <span>Total Weight:</span>
                    <span className="font-bold">{totalKg} kg</span>
                  </div>
                  <div className="flex justify-between text-lg">
                    <span>Price per kg:</span>
                    <span className="font-bold">KES {selectedCustomer.price_per_kg}</span>
                  </div>
                  <div className="flex justify-between text-lg">
                    <span>Subtotal:</span>
                    <span className="font-bold">KES {totalBill.toLocaleString()}</span>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="adjustment">Manual Adjustment (±)</Label>
                    <Input
                      id="adjustment"
                      type="number"
                      value={manualAdjustment}
                      onChange={(e) => setManualAdjustment(Number(e.target.value))}
                      placeholder="0"
                    />
                  </div>
                  <div className="border-t pt-4 flex justify-between text-xl">
                    <span className="font-semibold">Final Amount:</span>
                    <span className="font-bold text-primary">
                      KES {finalAmount.toLocaleString()}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Delivery Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <Label htmlFor="notes">Notes (Optional)</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Special instructions, observations, etc..."
                    rows={8}
                    className="mt-2"
                  />
                </CardContent>
              </Card>
            </div>

            <div className="flex justify-center">
              <Button
                size="lg"
                onClick={handleSubmitDelivery}
                disabled={submitting || totalKg === 0}
                className="gap-2"
              >
                <Package className="h-5 w-5" />
                {submitting ? "Creating Delivery..." : "Create Delivery"}
              </Button>
            </div>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
