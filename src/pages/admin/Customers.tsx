import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { SubNav } from "@/components/SubNav";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Phone, Mail, AlertCircle } from "lucide-react";
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
  const [loading, setLoading] = useState(true);

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

  if (loading || !user) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header user={user} onLogout={handleLogout} />
      <SubNav role={user.role} />
      <div className="container py-8 flex-1">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Customer Management</h1>
          <p className="text-muted-foreground">View and manage all customers</p>
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
    </div>
  );
}