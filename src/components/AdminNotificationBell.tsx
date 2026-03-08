import { useState } from "react";
import { NotificationBell } from "@/components/NotificationBell";
import { useNotifications } from "@/hooks/useNotifications";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEffect } from "react";

export function AdminNotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications({ isAdmin: true });
  const { toast } = useToast();
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [notificationMessage, setNotificationMessage] = useState("");
  const [notificationType, setNotificationType] = useState("general");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (sendDialogOpen && customers.length === 0) {
      supabase
        .from("customers")
        .select("id, shop_name, in_charge_name")
        .is("deleted_at", null)
        .order("shop_name")
        .then(({ data }) => {
          if (data) setCustomers(data);
        });
    }
  }, [sendDialogOpen]);

  const handleSendNotification = async () => {
    if (!selectedCustomer || !notificationMessage.trim()) {
      toast({ title: "Error", description: "Please select a customer and enter a message.", variant: "destructive" });
      return;
    }

    setSending(true);
    try {
      const { error } = await supabase.functions.invoke("send-notification", {
        body: {
          customerId: selectedCustomer,
          message: notificationMessage,
          type: notificationType,
          status: notificationType,
        },
      });

      if (error) throw error;

      toast({ title: "Sent", description: "Notification sent successfully." });
      setSendDialogOpen(false);
      setNotificationMessage("");
      setSelectedCustomer("");
      setNotificationType("general");
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to send notification.", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <NotificationBell
        notifications={notifications}
        unreadCount={unreadCount}
        onMarkAsRead={markAsRead}
        onMarkAllAsRead={markAllAsRead}
        notificationsPage="/admin/notifications"
        showSendNotification
        onSendNotification={() => setSendDialogOpen(true)}
      />

      <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Notification</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Customer</Label>
              <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
                <SelectTrigger>
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.shop_name} ({c.in_charge_name})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={notificationType} onValueChange={setNotificationType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="order_update">Order Update</SelectItem>
                  <SelectItem value="payment_reminder">Payment Reminder</SelectItem>
                  <SelectItem value="delivery_update">Delivery Update</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea
                value={notificationMessage}
                onChange={(e) => setNotificationMessage(e.target.value)}
                placeholder="Enter notification message..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSendNotification} disabled={sending}>
              {sending ? "Sending..." : "Send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
