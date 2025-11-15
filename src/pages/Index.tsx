import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/Header";
import { supabase } from "@/integrations/supabase/client";
import { Package, TrendingUp, Shield, Users } from "lucide-react";
import logo from "@/assets/logo.png";

export default function Index() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);

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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
      <Header />
      
      {/* Hero Section with Video Background */}
      <div className="relative overflow-hidden">
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
              <Button asChild variant="outline" size="lg" className="text-lg">
                <a href="#features">Learn More</a>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <section id="features" className="container py-20">
        <h2 className="text-3xl font-bold text-center mb-12">Key Features</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="bg-card p-6 rounded-lg shadow-card space-y-3">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Package className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-semibold text-lg">Automated Billing</h3>
            <p className="text-muted-foreground">
              Calculate charges automatically based on cylinder capacity and customer-specific rates.
            </p>
          </div>

          <div className="bg-card p-6 rounded-lg shadow-card space-y-3">
            <div className="h-12 w-12 rounded-lg bg-secondary/10 flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-secondary" />
            </div>
            <h3 className="font-semibold text-lg">Payment Tracking</h3>
            <p className="text-muted-foreground">
              Track M-Pesa, bank transfers, and cash payments with automatic arrears management.
            </p>
          </div>

          <div className="bg-card p-6 rounded-lg shadow-card space-y-3">
            <div className="h-12 w-12 rounded-lg bg-success/10 flex items-center justify-center">
              <Shield className="h-6 w-6 text-success" />
            </div>
            <h3 className="font-semibold text-lg">Secure Receipts</h3>
            <p className="text-muted-foreground">
              Generate and archive professional receipts with timestamps and download capability.
            </p>
          </div>

          <div className="bg-card p-6 rounded-lg shadow-card space-y-3">
            <div className="h-12 w-12 rounded-lg bg-warning/10 flex items-center justify-center">
              <Users className="h-6 w-6 text-warning" />
            </div>
            <h3 className="font-semibold text-lg">Multi-User Access</h3>
            <p className="text-muted-foreground">
              Separate portals for admin, staff, and customers with role-based permissions.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container py-20">
        <div className="bg-gradient-to-r from-primary to-primary-glow rounded-2xl p-12 text-center text-primary-foreground">
          <h2 className="text-3xl font-bold mb-4">Ready to streamline your operations?</h2>
          <p className="text-lg mb-8 opacity-90">
            Contact our team to get started with Finegas Supply Management System
          </p>
          <Button asChild variant="secondary" size="lg">
            <Link to="/login">Access Portal</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
