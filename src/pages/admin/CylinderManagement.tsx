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
  CardFooter,
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, Package } from "lucide-react";

interface CylinderCapacity {
  id: string;
  capacity_kg: number;
}

export default function CylinderManagement() {
  const [user, setUser] = useState<any>(null);
  const [cylinders, setCylinders] = useState<CylinderCapacity[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedCylinder, setSelectedCylinder] = useState<CylinderCapacity | null>(null);
  const [editingCylinder, setEditingCylinder] = useState<CylinderCapacity | null>(null);
  const [capacityValue, setCapacityValue] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();

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

  const loadCylinders = async () => {
    const { data, error } = await supabase
      .from("cylinder_capacities")
      .select("*")
      .order("capacity_kg", { ascending: true });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to load cylinder sizes",
        variant: "destructive",
      });
      return;
    }

    if (data) {
      setCylinders(data);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const capacity = parseFloat(capacityValue);
      if (isNaN(capacity) || capacity <= 0) {
        throw new Error("Please enter a valid capacity");
      }

      if (editingCylinder) {
        const { error } = await supabase
          .from("cylinder_capacities")
          .update({ capacity_kg: capacity })
          .eq("id", editingCylinder.id);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Cylinder size updated. Changes are now visible to all customers.",
        });
      } else {
        // Check if capacity already exists
        const exists = cylinders.some(c => c.capacity_kg === capacity);
        if (exists) {
          throw new Error("This cylinder size already exists");
        }

        const { error } = await supabase
          .from("cylinder_capacities")
          .insert({ capacity_kg: capacity });

        if (error) throw error;

        toast({
          title: "Success",
          description: "New cylinder size added. It's now available to all customers.",
        });
      }

      setDialogOpen(false);
      setEditingCylinder(null);
      setCapacityValue("");
      loadCylinders();
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

  const handleEdit = (cylinder: CylinderCapacity) => {
    setEditingCylinder(cylinder);
    setCapacityValue(cylinder.capacity_kg.toString());
    setDialogOpen(true);
  };

  const handleDeleteClick = (cylinder: CylinderCapacity) => {
    setSelectedCylinder(cylinder);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedCylinder) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("cylinder_capacities")
        .delete()
        .eq("id", selectedCylinder.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Cylinder size removed. It's no longer available to customers.",
      });

      loadCylinders();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setDeleteDialogOpen(false);
      setSelectedCylinder(null);
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
            <h1 className="text-3xl font-bold">Cylinder Sizes</h1>
            <p className="text-muted-foreground">
              Manage gas cylinder capacities visible to all customers
            </p>
          </div>
          <Dialog
            open={dialogOpen}
            onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) {
                setEditingCylinder(null);
                setCapacityValue("");
              }
            }}
          >
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Cylinder Size
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingCylinder ? "Edit Cylinder Size" : "Add New Cylinder Size"}
                </DialogTitle>
                <DialogDescription>
                  {editingCylinder
                    ? "Update the cylinder capacity. This change will sync to all customers immediately."
                    : "Add a new cylinder size. It will be available to all customers for ordering."}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="capacity">Capacity (KG)</Label>
                  <Input
                    id="capacity"
                    type="number"
                    step="0.5"
                    min="0.5"
                    value={capacityValue}
                    onChange={(e) => setCapacityValue(e.target.value)}
                    placeholder="e.g., 13"
                    required
                  />
                </div>
                <Button type="submit" disabled={loading} className="w-full">
                  {loading
                    ? "Saving..."
                    : editingCylinder
                    ? "Update Cylinder Size"
                    : "Add Cylinder Size"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {cylinders.map((cylinder) => (
            <Card key={cylinder.id} className="flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Package className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl">{cylinder.capacity_kg}kg</CardTitle>
                    <CardDescription>Cylinder</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1">
                <p className="text-sm text-muted-foreground">
                  Available for customer ordering
                </p>
              </CardContent>
              <CardFooter className="gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEdit(cylinder)}
                  className="flex-1"
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDeleteClick(cylinder)}
                  className="flex-1"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        {cylinders.length === 0 && (
          <Card className="text-center py-12">
            <CardContent>
              <Package className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                No cylinder sizes configured. Click "Add Cylinder Size" to get started.
              </p>
            </CardContent>
          </Card>
        )}
      </main>
      <Footer />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Cylinder Size</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove the {selectedCylinder?.capacity_kg}kg cylinder size?
              This will make it unavailable for all customers to order.
              Existing orders with this cylinder size will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
