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
import { useToast } from "@/hooks/use-toast";
import { Edit, Mail, Phone } from "lucide-react";

interface AdminContact {
  id: string;
  username: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  role: string;
}

export default function Contacts() {
  const [user, setUser] = useState<any>(null);
  const [admins, setAdmins] = useState<AdminContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialog, setEditDialog] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState<AdminContact | null>(null);
  const [editData, setEditData] = useState({ phone: "", email: "" });
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkAuth();
    loadAdmins();
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
      .in("role", ["admin", "co_admin"])
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

    setUser({ ...profile, role: roleData.role });
    setLoading(false);
  };

  const loadAdmins = async () => {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("*, user_roles!inner(role)")
      .in("user_roles.role", ["admin", "co_admin"])
      .order("user_roles.role", { ascending: true });

    if (profiles) {
      const adminContacts: AdminContact[] = profiles.map((p: any) => ({
        id: p.id,
        username: p.username,
        full_name: p.full_name,
        phone: p.phone,
        email: null, // Will be fetched via edge function
        role: p.user_roles[0].role,
      }));

      // Get emails via server-side edge function
      for (const admin of adminContacts) {
        try {
          const { data, error } = await supabase.functions.invoke("admin-operations", {
            body: {
              action: "get-user-email",
              userId: admin.id,
            },
          });
          
          if (!error && data?.email) {
            admin.email = data.email;
          }
        } catch (err) {
          console.error("Failed to fetch email for admin:", admin.id);
        }
      }

      setAdmins(adminContacts);
    }
  };

  const handleEdit = (admin: AdminContact) => {
    setSelectedAdmin(admin);
    setEditData({ phone: admin.phone || "", email: admin.email || "" });
    setEditDialog(true);
  };

  const handleUpdateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAdmin) return;

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ phone: editData.phone })
        .eq("id", selectedAdmin.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Contact information updated",
      });

      setEditDialog(false);
      loadAdmins();
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
      <main className="container mx-auto p-6 flex-1">
        <div className="mb-6">
          <BackButton />
        </div>
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Admin Contacts</h1>
          <p className="text-muted-foreground">
            View and manage administrator contact information
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {admins.map((admin) => (
            <Card key={admin.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>
                    {admin.username === "jemo"
                      ? "Jemo"
                      : admin.username === "lonvis"
                      ? "Lonvis"
                      : admin.full_name}
                  </span>
                  {user.role === "admin" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(admin)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  )}
                </CardTitle>
                <CardDescription className="capitalize">
                  {admin.role.replace("_", " ")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{admin.phone || "Not provided"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{admin.email || "Not provided"}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
      <Footer />

      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Contact Information</DialogTitle>
            <DialogDescription>
              Update the contact details for {selectedAdmin?.full_name}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateContact} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                value={editData.phone}
                onChange={(e) =>
                  setEditData({ ...editData, phone: e.target.value })
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email (Read-only)</Label>
              <Input
                id="email"
                type="email"
                value={editData.email}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                Email cannot be changed from here
              </p>
            </div>
            <Button type="submit" className="w-full">
              Update Contact
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
