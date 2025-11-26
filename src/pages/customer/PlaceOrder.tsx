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
import { ShoppingCart, Plus, Minus } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface CylinderCapacity {
  id: string;
  capacity_kg: number;
}

interface OrderItem {
  cylinder_capacity_id: string;
  capacity_kg: number;
  quantity: number;
  kg_contribution: number;
}

export default function PlaceOrder() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [customer, setCustomer] = useState<any>(null);
  const [cylinders, setCylinders] = useState<CylinderCapacity[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    checkAuth();
    loadCylinders();
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
      navigate("/");
      return;
    }

    setUser(session.user);
    setCustomer(customerData);
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
  const totalBill = totalKg * (customer?.price_per_kg || 0);

  const handleSubmitOrder = async () => {
    if (totalKg === 0) {
      toast({
        title: "Error",
        description: "Please add at least one cylinder to your order",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const { data: deliveryData, error: deliveryError } = await supabase
        .from("deliveries")
        .insert({
          customer_id: customer.id,
          logged_by_user_id: user.id,
          total_kg: totalKg,
          price_per_kg_at_time: customer.price_per_kg,
          total_charge: totalBill,
          notes: notes || null,
          manual_adjustment: 0,
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

      const newBalance = (customer.arrears_balance || 0) + totalBill;
      const { error: updateError } = await supabase
        .from("customers")
        .update({ arrears_balance: newBalance })
        .eq("id", customer.id);

      if (updateError) throw updateError;

      toast({
        title: "Success",
        description: "Order placed successfully",
      });

      navigate("/customer/orders");
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

  if (!user || !customer) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header user={{ username: customer.username }} onLogout={handleLogout} />
      <SubNav role="customer" />
      <div className="container py-8 flex-1">
        <div className="mb-6">
          <BackButton />
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold">Place Order</h1>
          <p className="text-muted-foreground">Select gas cylinders for delivery</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
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

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between text-lg">
                <span>Total Weight:</span>
                <span className="font-bold">{totalKg} kg</span>
              </div>
              <div className="flex justify-between text-lg">
                <span>Price per kg:</span>
                <span className="font-bold">KES {customer.price_per_kg}</span>
              </div>
              <div className="border-t pt-4 flex justify-between text-xl">
                <span className="font-semibold">Total Bill:</span>
                <span className="font-bold text-primary">
                  KES {totalBill.toLocaleString()}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Additional Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <Label htmlFor="notes">Delivery Instructions (Optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="E.g., Gate code, special instructions..."
                rows={5}
                className="mt-2"
              />
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 flex justify-center">
          <Button
            size="lg"
            onClick={handleSubmitOrder}
            disabled={submitting || totalKg === 0}
            className="gap-2"
          >
            <ShoppingCart className="h-5 w-5" />
            {submitting ? "Placing Order..." : "Place Order"}
          </Button>
        </div>
      </div>
      <Footer />
    </div>
  );
}
