import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { SubNav } from "@/components/SubNav";
import { BackButton } from "@/components/BackButton";
import { Footer } from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Phone, Mail, AlertCircle, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Customer {
  id: string;
  shop_name: string;
  in_charge_name: string;
  phone: string;
  email: string;
  arrears_balance: number;
  address: string;
  price_per_kg: number;
  status: string;
}

export default function AdminCustomers() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newCustomer, setNewCustomer] = useState({
    shop_name: "",
    in_charge_name: "",
    username: "",
    phone: "",
    email: "",
    address: "",
    price_per_kg: "",
    password: "finecustomer",
  });

  useEffect(() => {
    checkAuth();
    loadCustomers();
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
      .maybeSingle();

    if (!roleData || (roleData.role !== "admin" && roleData.role !== "co_admin" && roleData.role !== "staff")) {
      toast({
        title: "Access Denied",
        description: "You don't have permission to access this page.",
        variant: "destructive",
      });
      navigate("/");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .single();

    setUser({ ...session.user, ...profile, role: roleData.role });
    setLoading(false);
  };

  const loadCustomers = async () => {
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .is("deleted_at", null)
      .order("shop_name");

    if (error) {
      toast({
        title: "Error",
        description: "Failed to load customers",
        variant: "destructive",
      });
      return;
    }

    setCustomers(data || []);
  };

  const handleCustomerClick = (customer: Customer) => {
    navigate(`/admin/customers/${customer.id}`);
  };

  const handleRemoveCustomer = async (customerId: string) => {
    try {
      const { error } = await supabase
        .from("customers")
        .update({ deleted_at: new Date().toISOString(), status: "inactive" })
        .eq("id", customerId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Customer removed from system",
      });

      loadCustomers();
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

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newCustomer.email,
        password: newCustomer.password,
        options: {
          data: {
            username: newCustomer.username,
            full_name: newCustomer.in_charge_name,
          },
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (authError) throw authError;

      if (authData.user) {
        const { error: customerError } = await supabase.from("customers").insert({
          user_id: authData.user.id,
          shop_name: newCustomer.shop_name,
          in_charge_name: newCustomer.in_charge_name,
          username: newCustomer.username,
          phone: newCustomer.phone,
          email: newCustomer.email,
          address: newCustomer.address,
          price_per_kg: Number(newCustomer.price_per_kg),
          arrears_balance: 0,
        });

        if (customerError) throw customerError;

        const { error: roleError } = await supabase.from("user_roles").insert({
          user_id: authData.user.id,
          role: "customer",
        });

        if (roleError) throw roleError;

        toast({
          title: "Success",
          description: "Customer added successfully",
        });

        setShowAddDialog(false);
        setNewCustomer({
          shop_name: "",
          in_charge_name: "",
          username: "",
          phone: "",
          email: "",
          address: "",
          price_per_kg: "",
          password: "finecustomer",
        });
        loadCustomers();
      }
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

  if (loading || !user) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header user={user} onLogout={handleLogout} />
      <SubNav role={user.role} />
      <div className="container py-8 flex-1">
        <div className="mb-6">
          <BackButton />
        </div>
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Customer Management</h1>
            <p className="text-muted-foreground">View and manage all customers</p>
          </div>
          <Button onClick={() => setShowAddDialog(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Customer
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {customers.map((customer) => (
            <Card
              key={customer.id}
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => handleCustomerClick(customer)}
            >
              <CardHeader>
                <CardTitle className="flex items-start justify-between">
                  <span className="text-lg">{customer.shop_name}</span>
                  {customer.arrears_balance > 0 && (
                    <AlertCircle className="h-5 w-5 text-warning flex-shrink-0" />
                  )}
                </CardTitle>
                <p className="text-sm text-muted-foreground">{customer.in_charge_name}</p>
              </CardHeader>
              <CardContent className="space-y-3">
                {customer.arrears_balance > 0 && (
                  <div className="bg-warning/10 p-3 rounded-md">
                    <p className="text-sm font-medium text-warning">Pending Arrears</p>
                    <p className="text-xl font-bold text-warning">
                      KES {customer.arrears_balance.toLocaleString()}
                    </p>
                  </div>
                )}
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.location.href = `tel:${customer.phone}`;
                    }}
                  >
                    <Phone className="h-4 w-4 mr-2" />
                    Contact Customer
                  </Button>
                  {user.role === "admin" && (
                    <Button
                      variant="destructive"
                      size="sm"
                      className="w-full"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Remove ${customer.shop_name} from the system?`)) {
                          handleRemoveCustomer(customer.id);
                        }
                      }}
                    >
                      Remove Customer
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {customers.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No customers found</p>
          </div>
        )}
      </div>
      <Footer />

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Customer</DialogTitle>
            <DialogDescription>
              Create a new customer account with custom pricing
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddCustomer} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="shop_name">Shop Name *</Label>
                <Input
                  id="shop_name"
                  value={newCustomer.shop_name}
                  onChange={(e) =>
                    setNewCustomer({ ...newCustomer, shop_name: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="in_charge_name">Person In Charge *</Label>
                <Input
                  id="in_charge_name"
                  value={newCustomer.in_charge_name}
                  onChange={(e) =>
                    setNewCustomer({ ...newCustomer, in_charge_name: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="username">Username *</Label>
                <Input
                  id="username"
                  value={newCustomer.username}
                  onChange={(e) =>
                    setNewCustomer({ ...newCustomer, username: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={newCustomer.email}
                  onChange={(e) =>
                    setNewCustomer({ ...newCustomer, email: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone *</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={newCustomer.phone}
                  onChange={(e) =>
                    setNewCustomer({ ...newCustomer, phone: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price_per_kg">Price Per KG (KES) *</Label>
                <Input
                  id="price_per_kg"
                  type="number"
                  step="0.01"
                  value={newCustomer.price_per_kg}
                  onChange={(e) =>
                    setNewCustomer({ ...newCustomer, price_per_kg: e.target.value })
                  }
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={newCustomer.address}
                onChange={(e) =>
                  setNewCustomer({ ...newCustomer, address: e.target.value })
                }
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating..." : "Create Customer"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}