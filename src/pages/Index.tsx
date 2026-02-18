import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { Mail, Phone, Linkedin } from "lucide-react";
import logo from "@/assets/logo.png";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function Index() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [contactOpen, setContactOpen] = useState(false);

  useEffect(() => {
    // Check if user is already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        // Redirect based on role
        checkUserRole(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
        checkUserRole(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkUserRole = async (userId: string) => {
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();

    if (roleData?.role === "admin" || roleData?.role === "staff") {
      navigate("/admin/dashboard");
    } else {
      const { data: customerData } = await supabase
        .from("customers")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      if (customerData) {
        navigate("/customer/dashboard");
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted flex flex-col">
      <Header />
      
      {/* Hero Section with Video Background */}
      <div className="relative overflow-hidden flex-1">
        <video 
          autoPlay 
          muted 
          loop 
          className="absolute top-0 left-0 w-full h-full object-cover opacity-20"
        >
          <source src="/molecules.mp4" type="video/mp4" />
        </video>
        
        <div className="relative container py-20 md:py-32">
          <div className="mx-auto max-w-3xl text-center space-y-8">
            <div className="flex justify-center mb-8">
              <img src={logo} alt="Fine Gas Limited" className="h-32 w-32" />
            </div>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
              Fine Gas Limited <span className="text-primary">Management System</span>
            </h1>
            <p className="text-xl text-muted-foreground">
              Professional gas cylinder supply management with automated billing, 
              payment tracking, and comprehensive reporting.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" className="text-lg">
                <Link to="/login">Get Started</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <section className="container py-20">
        <div className="bg-gradient-to-r from-primary to-primary-glow rounded-2xl p-12 text-center text-primary-foreground">
          <h2 className="text-3xl font-bold mb-4">Ready to streamline your operations?</h2>
          <p className="text-lg mb-8 opacity-90">
            Contact our developer to get started with Finegas Supply Management System
          </p>
          <Dialog open={contactOpen} onOpenChange={setContactOpen}>
            <DialogTrigger asChild>
              <Button variant="secondary" size="lg">
                Contact Developer
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Developer Contact Details</DialogTitle>
                <DialogDescription>
                  Get in touch with the system developer
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="flex items-start gap-3">
                  <Mail className="h-5 w-5 text-primary mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Email</p>
                    <a href="mailto:devmimi2@gmail.com" className="text-sm text-muted-foreground hover:text-primary">
                      devmimi2@gmail.com
                    </a>
                    <br />
                    <a href="mailto:kibendi054@gmail.com" className="text-sm text-muted-foreground hover:text-primary">
                      kibendi054@gmail.com
                    </a>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <Phone className="h-5 w-5 text-primary mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Phone / WhatsApp</p>
                    <a href="tel:+254702255315" className="text-sm text-muted-foreground hover:text-primary block">
                      +254 702 255 315
                    </a>
                    <a href="https://web.whatsapp.com/send?phone=254702255315" target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
                      Chat on WhatsApp
                    </a>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <Linkedin className="h-5 w-5 text-primary mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">LinkedIn</p>
                    <a 
                      href="https://www.linkedin.com/in/dun-mimi-ndegwa" 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-sm text-primary hover:underline"
                    >
                      View Profile
                    </a>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </section>
      <Footer />
    </div>
  );
}
