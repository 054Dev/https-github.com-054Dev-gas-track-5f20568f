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
import { UserPlus, Mail, Phone, Shield } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface SubAdmin {
  id: string;
  username: string;
  full_name: string;
  phone: string | null;
  email: string;
  role: string;
}

export default function SubAdmins() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [subAdmins, setSubAdmins] = useState<SubAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newSubAdmin, setNewSubAdmin] = useState({
    full_name: "",
    username: "",
    email: "",
    phone: "",
    password: "",
  });

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
      .maybeSingle();

    if (roleData?.role !== "admin") {
      toast({
        title: "Access Denied",
        description: "Only admins can manage sub-admins",
        variant: "destructive",
      });
      navigate("/admin/dashboard");
      return;
    }

    setUser(session.user);
    loadSubAdmins();
  };

  const loadSubAdmins = async () => {
    setLoading(true);
    
    try {
      // Get all co_admin user IDs first
      const { data: rolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "co_admin");

      if (rolesError) throw rolesError;

      if (rolesData && rolesData.length > 0) {
        const userIds = rolesData.map((r) => r.user_id);
        
        // Get profiles for these users
        const { data: profilesData, error: profilesError } = await supabase
          .from("profiles")
          .select("id, username, full_name, phone")
          .in("id", userIds);

        if (profilesError) throw profilesError;

        if (profilesData) {
          const subAdminsList: SubAdmin[] = profilesData.map((profile) => ({
            id: profile.id,
            username: profile.username,
            full_name: profile.full_name,
            phone: profile.phone,
            email: `${profile.username}@system.local`,
            role: "co_admin",
          }));
          setSubAdmins(subAdminsList);
        } else {
          setSubAdmins([]);
        }
      } else {
        setSubAdmins([]);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load sub-admins",
        variant: "destructive",
      });
      setSubAdmins([]);
    } finally {
      setLoading(false);
    }
  };

  const createSubAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: newSubAdmin.email,
        password: newSubAdmin.password,
        options: {
          data: {
            username: newSubAdmin.username,
            full_name: newSubAdmin.full_name,
            phone: newSubAdmin.phone,
          },
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (signUpError) throw signUpError;

      if (signUpData.user) {
        // Profile is auto-created by trigger, just add role
        const { error: roleError } = await supabase.from("user_roles").insert({
          user_id: signUpData.user.id,
          role: "co_admin",
        });

        if (roleError) throw roleError;

        toast({
          title: "Success",
          description: "Sub-admin created successfully",
        });

        setDialogOpen(false);
        setNewSubAdmin({ full_name: "", username: "", email: "", phone: "", password: "" });
        loadSubAdmins();
      }
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

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header user={{ username: user.email }} onLogout={handleLogout} />
      <SubNav role="admin" />
      <div className="container py-8 flex-1">
        <div className="mb-6 flex items-center justify-between">
          <BackButton />
          <div className="flex-1 text-center">
            <h1 className="text-3xl font-bold">Sub-Admin Management</h1>
            <p className="text-muted-foreground">Manage co-administrators</p>
          </div>
          <Button onClick={() => setDialogOpen(true)} className="gap-2">
            <UserPlus className="h-4 w-4" />
            Add Sub-Admin
          </Button>
        </div>

        {loading ? (
          <p className="text-center text-muted-foreground">Loading...</p>
        ) : subAdmins.length === 0 ? (
          <p className="text-center text-muted-foreground">No sub-admins found</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {subAdmins.map((subAdmin) => (
              <Card key={subAdmin.id}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-primary" />
                    {subAdmin.full_name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{subAdmin.email}</span>
                  </div>
                  {subAdmin.phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{subAdmin.phone}</span>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">@{subAdmin.username}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
      <Footer />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Sub-Admin</DialogTitle>
            <DialogDescription>
              Create a new co-administrator account
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={createSubAdmin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">Full Name</Label>
              <Input
                id="full_name"
                value={newSubAdmin.full_name}
                onChange={(e) =>
                  setNewSubAdmin({ ...newSubAdmin, full_name: e.target.value })
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={newSubAdmin.username}
                onChange={(e) =>
                  setNewSubAdmin({ ...newSubAdmin, username: e.target.value })
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={newSubAdmin.email}
                onChange={(e) =>
                  setNewSubAdmin({ ...newSubAdmin, email: e.target.value })
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={newSubAdmin.phone}
                onChange={(e) =>
                  setNewSubAdmin({ ...newSubAdmin, phone: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={newSubAdmin.password}
                onChange={(e) =>
                  setNewSubAdmin({ ...newSubAdmin, password: e.target.value })
                }
                required
              />
            </div>
            <Button type="submit" className="w-full">
              Create Sub-Admin
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
