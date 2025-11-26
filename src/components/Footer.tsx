import { Phone, MessageCircle, Bell } from "lucide-react";
import { Button } from "./ui/button";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const ADMIN_PHONE = "+254712345678"; // Default admin phone
const ADMIN_EMAIL = "admin@finegas.com";

export function Footer() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    contact: "",
    email: "",
    message: "",
  });
  const { toast } = useToast();

  const handleCall = () => {
    window.location.href = `tel:${ADMIN_PHONE}`;
  };

  const handleWhatsApp = () => {
    window.open(
      `https://wa.me/${ADMIN_PHONE.replace(/\+/g, "")}?text=Hello, I need assistance`,
      "_blank"
    );
  };

  const handleSubmitNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: "Error",
          description: "Please log in to send a notification",
          variant: "destructive",
        });
        return;
      }

      // Get customer record
      const { data: customer } = await supabase
        .from("customers")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!customer) {
        toast({
          title: "Error",
          description: "Customer profile not found. This feature is only available to customers.",
          variant: "destructive",
        });
        return;
      }

      const message = `Name: ${formData.name}\nContact: ${formData.contact}\nEmail: ${formData.email}\n\nMessage:\n${formData.message}`;

      const { error } = await supabase.from("notifications").insert({
        customer_id: customer.id,
        type: "contact_request",
        message,
        status: "pending",
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Your message has been sent to the admin",
      });

      setDialogOpen(false);
      setFormData({ name: "", contact: "", email: "", message: "" });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <footer className="border-t bg-card mt-auto py-4 md:py-6">
        <div className="container mx-auto px-4 md:px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-xs md:text-sm text-muted-foreground text-center md:text-left">
              © 2025 Fine Gas Limited. All rights reserved.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCall}
                className="gap-2 w-full sm:w-auto"
              >
                <Phone className="h-4 w-4" />
                <span className="text-xs md:text-sm">Call Admin</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleWhatsApp}
                className="gap-2 w-full sm:w-auto"
              >
                <MessageCircle className="h-4 w-4" />
                <span className="text-xs md:text-sm">WhatsApp</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDialogOpen(true)}
                className="gap-2 w-full sm:w-auto"
              >
                <Bell className="h-4 w-4" />
                <span className="text-xs md:text-sm">Contact</span>
              </Button>
            </div>
          </div>
        </div>
      </footer>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="w-[95vw] max-w-md mx-auto">
          <DialogHeader>
            <DialogTitle className="text-lg md:text-xl">Contact Admin</DialogTitle>
            <DialogDescription className="text-xs md:text-sm">
              Send a message to the administrator. We'll get back to you soon.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitNotification} className="space-y-3 md:space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Your Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact">Phone Number</Label>
              <Input
                id="contact"
                type="tel"
                value={formData.contact}
                onChange={(e) =>
                  setFormData({ ...formData, contact: e.target.value })
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                value={formData.message}
                onChange={(e) =>
                  setFormData({ ...formData, message: e.target.value })
                }
                required
                rows={4}
              />
            </div>
            <Button type="submit" className="w-full">
              Send Message
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
