import { useEffect, useState } from "react";
import { PageSkeleton } from "@/components/PageSkeleton";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { SubNav } from "@/components/SubNav";
import { BackButton } from "@/components/BackButton";
import { Footer } from "@/components/Footer";
import { CustomerNotificationBell } from "@/components/CustomerNotificationBell";
import { NotificationItem } from "@/components/NotificationItem";
import { supabase } from "@/integrations/supabase/client";
import { useNotifications } from "@/hooks/useNotifications";
import { Card, CardContent } from "@/components/ui/card";
import { Bell } from "lucide-react";

export default function CustomerNotifications() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [customer, setCustomer] = useState<any>(null);

  const { notifications, loading, unreadCount, markAsRead, markAllAsRead } = useNotifications({
    customerId: customer?.id,
  });

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { navigate("/login"); return; }

    const { data: customerData } = await supabase
      .from("customers")
      .select("*")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (!customerData) { navigate("/"); return; }

    setUser(session.user);
    setCustomer(customerData);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  if (!user || !customer) return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <SubNav role="customer" />
      <div className="container py-8 flex-1"><PageSkeleton variant="list" /></div>
      <Footer />
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header user={{ username: customer.username }} onLogout={handleLogout}>
        <CustomerNotificationBell customerId={customer.id} />
      </Header>
      <SubNav role="customer" />
      <div className="container py-4 md:py-8 px-4 md:px-6 flex-1">
        <div className="mb-4"><BackButton /></div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Notifications</h1>
            <p className="text-sm text-muted-foreground">
              {unreadCount > 0 ? `${unreadCount} unread` : "All caught up!"}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Loading notifications...</div>
        ) : notifications.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold text-lg mb-2">No notifications</h3>
              <p className="text-muted-foreground">You'll see updates about your orders and deliveries here.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {notifications.map((n) => (
              <NotificationItem
                key={n.id}
                notification={n}
                senderName="Fine Gas Admin"
                onMarkAsRead={markAsRead}
              />
            ))}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
