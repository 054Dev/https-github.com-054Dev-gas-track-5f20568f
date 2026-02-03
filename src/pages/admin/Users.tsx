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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Eye, EyeOff, Copy } from "lucide-react";
import { generateSecurePassword, validateAdminPasswordPolicy, validateCustomerPasswordPolicy, validateEmail } from "@/lib/password-utils";

export default function Users() {
  const [user, setUser] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState("");
  const [newUser, setNewUser] = useState({
    email: "",
    username: "",
    fullName: "",
    phone: "",
    role: "customer",
    password: "",
  });
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkAuth();
    loadUsers();
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

  const loadUsers = async () => {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("*, user_roles(role)")
      .order("created_at", { ascending: false });

    if (profiles) {
      const usersWithRoles = profiles.map((p: any) => ({
        ...p,
        role: p.user_roles?.[0]?.role || "customer",
      }));
      setUsers(usersWithRoles);
    }
  };

  const handleGeneratePassword = () => {
    const password = generateSecurePassword(12);
    setGeneratedPassword(password);
    setNewUser({ ...newUser, password });
  };

  const handleCopyPassword = () => {
    navigator.clipboard.writeText(generatedPassword);
    toast({
      title: "Copied",
      description: "Password copied to clipboard",
    });
  };

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Only admin can create co_admin
      if (newUser.role === "co_admin" && user.role !== "admin") {
        throw new Error("Only admin can add co-admins");
      }

      // Always require a password - generate one if not provided for customers
      let password = newUser.password;
      if (!password) {
        if (newUser.role === "customer") {
          password = generateSecurePassword(12);
          setGeneratedPassword(password);
        } else {
          throw new Error("Password is required");
        }
      }

      // Validate email format
      const emailCheck = validateEmail(newUser.email);
      if (!emailCheck.valid) {
        throw new Error(emailCheck.message);
      }

      // Use stricter validation for admin/staff, basic for customers
      const isAdminOrStaff = ["admin", "co_admin", "staff"].includes(newUser.role);
      const { valid, message } = isAdminOrStaff
        ? validateAdminPasswordPolicy(password, {
            email: newUser.email,
            username: newUser.username,
            fullName: newUser.fullName,
            phone: newUser.phone,
          })
        : validateCustomerPasswordPolicy(password);

      if (!valid) {
        throw new Error(message);
      }

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newUser.email,
        password: password,
        options: {
          data: {
            username: newUser.username,
            full_name: newUser.fullName,
            phone: newUser.phone,
          },
        },
      });

      if (authError) throw authError;

      if (authData.user) {
        const { error: roleError } = await supabase.from("user_roles").insert({
          user_id: authData.user.id,
          role: newUser.role as any,
        });

        if (roleError) throw roleError;

        const { error: profileError } = await supabase.from("profiles").insert({
          id: authData.user.id,
          username: newUser.username,
          full_name: newUser.fullName,
          phone: newUser.phone,
        });

        if (profileError) throw profileError;
      }

      toast({
        title: "Success",
        description: newUser.role === "customer" 
          ? "Customer created! Share the password securely with the customer."
          : "User created successfully!",
      });

      setDialogOpen(false);
      setGeneratedPassword("");
      setNewUser({
        email: "",
        username: "",
        fullName: "",
        phone: "",
        role: "customer",
        password: "",
      });
      loadUsers();
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
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">User Management</h1>
            <p className="text-muted-foreground">
              Manage administrators, staff, and customers
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add User
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New User</DialogTitle>
                <DialogDescription>
                  Add a new user to the system
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={createUser} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    value={newUser.fullName}
                    onChange={(e) =>
                      setNewUser({ ...newUser, fullName: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={newUser.username}
                    onChange={(e) =>
                      setNewUser({ ...newUser, username: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newUser.email}
                    onChange={(e) =>
                      setNewUser({ ...newUser, email: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={newUser.phone}
                    onChange={(e) =>
                      setNewUser({ ...newUser, phone: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select
                    value={newUser.role}
                    onValueChange={(value) =>
                      setNewUser({ ...newUser, role: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {user.role === "admin" && (
                        <>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="co_admin">Co-Admin</SelectItem>
                        </>
                      )}
                      <SelectItem value="staff">Staff</SelectItem>
                      <SelectItem value="customer">Customer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {newUser.role !== "customer" && (
                  <div className="space-y-2">
                    <Label htmlFor="password">Temporary Password *</Label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          value={newUser.password}
                          onChange={(e) =>
                            setNewUser({ ...newUser, password: e.target.value })
                          }
                          placeholder="Generate or enter password"
                          required
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                      <Button type="button" variant="outline" onClick={handleGeneratePassword}>
                        Generate
                      </Button>
                      {generatedPassword && (
                        <Button type="button" variant="outline" size="icon" onClick={handleCopyPassword}>
                          <Copy className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                )}
                {newUser.role === "customer" && (
                  <div className="space-y-2">
                    <Label htmlFor="password">Password *</Label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          value={newUser.password}
                          onChange={(e) =>
                            setNewUser({ ...newUser, password: e.target.value })
                          }
                          placeholder="Generate secure password"
                          required
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                      <Button type="button" variant="outline" onClick={handleGeneratePassword}>
                        Generate
                      </Button>
                      {generatedPassword && (
                        <Button type="button" variant="outline" size="icon" onClick={handleCopyPassword}>
                          <Copy className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Generate a secure password and share it with the customer via a secure channel.
                    </p>
                  </div>
                )}
                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? "Creating..." : "Create User"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {users.map((u) => (
            <Card key={u.id}>
              <CardHeader>
                <CardTitle>{u.full_name}</CardTitle>
                <CardDescription>@{u.username}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <p>
                    <span className="font-semibold">Email:</span> {u.email || "N/A"}
                  </p>
                  <p>
                    <span className="font-semibold">Phone:</span> {u.phone || "N/A"}
                  </p>
                  <p>
                    <span className="font-semibold">Role:</span>{" "}
                    <span className="capitalize">{u.role}</span>
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
