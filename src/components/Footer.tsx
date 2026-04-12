import { Phone, MessageCircle, Bell, Info } from "lucide-react";
import { Button } from "./ui/button";
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const DEV_PHONE = "+254702255315";
const DEV_WHATSAPP = "254702255315";

interface FooterProps {
  role?: "admin" | "co_admin" | "staff" | "customer";
}

export function Footer({ role }: FooterProps) {
  const isAdmin = role === "admin" || role === "co_admin" || role === "staff";
  const [dialogOpen, setDialogOpen] = useState(false);
  const [devDialogOpen, setDevDialogOpen] = useState(false);
  const [contactMessage, setContactMessage] = useState("");
  const [adminPhone, setAdminPhone] = useState("");
  const [adminWhatsapp, setAdminWhatsapp] = useState("");
  const { toast } = useToast();

  const whatsappText = encodeURIComponent("Hello, I clicked the link on Fine Gas Management System.");

  // Load admin contact details from profiles
  useEffect(() => {
    const loadAdminContact = async () => {
      const { data: adminRole } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin")
        .maybeSingle();

      if (adminRole?.user_id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("phone")
          .eq("id", adminRole.user_id)
          .maybeSingle();

        if (profile?.phone) {
          setAdminPhone(profile.phone);
          // Format for WhatsApp
          const cleaned = profile.phone.replace(/[\s\-\+]/g, "");
          setAdminWhatsapp(cleaned.startsWith("0") ? "254" + cleaned.slice(1) : cleaned);
        }
      }
    };
    if (!isAdmin) {
      loadAdminContact();
    }
  }, [isAdmin]);

  const handleCall = () => {
    const phone = adminPhone || DEV_PHONE;
    window.location.href = `tel:${phone}`;
  };

  const handleWhatsApp = () => {
    const phone = adminWhatsapp || DEV_WHATSAPP;
    const waUrl = `https://wa.me/${phone}?text=${whatsappText}`;
    window.open(waUrl, "_blank", "noopener,noreferrer");
  };

  const handleSubmitNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!contactMessage.trim()) {
      toast({ title: "Error", description: "Please enter a message", variant: "destructive" });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({ title: "Error", description: "Please log in to send a notification", variant: "destructive" });
        return;
      }

      const { data: customer } = await supabase
        .from("customers")
        .select("id, shop_name, in_charge_name, phone, email")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!customer) {
        toast({ title: "Error", description: "Customer profile not found.", variant: "destructive" });
        return;
      }

      const message = `Name: ${customer.in_charge_name}\nShop: ${customer.shop_name}\nPhone: ${customer.phone}\nEmail: ${customer.email || "N/A"}\n\nMessage:\n${contactMessage}`;

      const { error } = await supabase.from("notifications").insert({
        customer_id: customer.id,
        type: "contact_request",
        message,
        status: "pending",
      });

      if (error) throw error;

      toast({ title: "Success", description: "Your message has been sent to the admin" });
      setDialogOpen(false);
      setContactMessage("");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  return (
    <>
      <footer className="border-t bg-card mt-auto py-4 md:py-6">
        <div className="container mx-auto px-4 md:px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <p className="text-xs md:text-sm text-muted-foreground text-center md:text-left">
                © 2025 Fine Gas Limited. All rights reserved.
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDevDialogOpen(true)}
                className="h-6 px-2"
              >
                <Info className="h-3 w-3" />
              </Button>
            </div>
            {!isAdmin && (
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
            )}
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
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                value={contactMessage}
                onChange={(e) => setContactMessage(e.target.value)}
                placeholder="Type your message here..."
                required
                rows={5}
              />
            </div>
            <p className="text-xs text-muted-foreground">Your contact details will be attached automatically.</p>
            <Button type="submit" className="w-full">
              Send Message
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={devDialogOpen} onOpenChange={setDevDialogOpen}>
        <DialogContent className="w-[95vw] max-w-md mx-auto">
          <DialogHeader>
            <DialogTitle className="text-lg md:text-xl">Developer Information</DialogTitle>
            <DialogDescription className="text-xs md:text-sm">
              About the developer of this application
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Dun Mimi Ndegwa</h3>
              <p className="text-sm text-muted-foreground">Full-Stack Developer</p>
            </div>
            <div className="space-y-3">
              <div className="space-y-2">
                <p className="text-sm"><strong>Email:</strong> devmimi2@gmail.com</p>
                <p className="text-sm text-muted-foreground">Secondary: kibendi054@gmail.com</p>
              </div>
              <div>
                <p className="text-sm"><strong>WhatsApp/Phone:</strong> +254702255315</p>
              </div>
              <a 
                href={`https://wa.me/${DEV_WHATSAPP}?text=${whatsappText}`}
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-primary hover:underline"
              >
                <MessageCircle className="h-4 w-4" />
                Chat on WhatsApp
              </a>
              <a 
                href="https://www.linkedin.com/in/dun-mimi-ndegwa" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-primary hover:underline"
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                </svg>
                LinkedIn Profile
              </a>
              <a 
                href="https://duncanndegwa.lovable.app/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-primary hover:underline"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                </svg>
                View Portfolio
              </a>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
