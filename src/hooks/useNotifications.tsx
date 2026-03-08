import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface Notification {
  id: string;
  customer_id: string;
  message: string;
  type: string;
  created_at: string;
  status: string;
  sent_at: string | null;
}

interface UseNotificationsOptions {
  customerId?: string;
  isAdmin?: boolean;
}

export const useNotifications = ({ customerId, isAdmin }: UseNotificationsOptions = {}) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Types that represent messages FROM customers TO admin
  const CUSTOMER_TO_ADMIN_TYPES = ["contact_request"];

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (isAdmin) {
      // Admin only sees notifications sent BY customers (contact_request)
      query = query.in("type", CUSTOMER_TO_ADMIN_TYPES);
    } else if (customerId) {
      // Customers only see notifications sent TO them (not their own contact_request)
      query = query
        .eq("customer_id", customerId)
        .neq("type", "contact_request");
    }

    const { data } = await query;
    if (data) setNotifications(data);
    setLoading(false);
  }, [customerId, isAdmin]);

  const markAsRead = useCallback(async (notificationId: string) => {
    const { error } = await supabase
      .from("notifications")
      .update({ status: "read" })
      .eq("id", notificationId);

    if (!error) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, status: "read" } : n))
      );
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    const unreadIds = notifications
      .filter((n) => n.status !== "read")
      .map((n) => n.id);

    if (unreadIds.length === 0) return;

    const { error } = await supabase
      .from("notifications")
      .update({ status: "read" })
      .in("id", unreadIds);

    if (!error) {
      setNotifications((prev) => prev.map((n) => ({ ...n, status: "read" })));
    }
  }, [notifications]);

  useEffect(() => {
    if (!isAdmin && !customerId) return;

    // Initialize audio
    audioRef.current = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTcIG2m98OScTgwOUKnk77RgGwU7k9n0yXkpBSh+zPLaizsKGGS46+mcUBELTKXh8bllHAU2jdXzzn0vBSV8zPDdj0EKGV/A7emiUxILRaDh8bVjHAU5j9j1ynopBSh+zPDajDwKF2G36+uaUhIMSaDh8bVkGwU7jtj1yXkpBSh+y/DajD0KF2G26+ycURILRaDg8bVkGwU7jtj1yHgoBSh+y/DajD0KF2G26+ycURILRaDg8bVkGwU7jtj1yHgoBSh+y/DajD0KF2G26+ycURILRaDg8bVkGwU7jtj1yHgoBSh+y/DajD0KF2G26+ycURILRaDg8bVkGwU7jtj1yHgoBSh+y/DajD0KF2G26+ycURILRaDg8bVkGwU7jtj1yHgoBSh+y/DajD0KF2G26+ycURILRaDg8bVkGwU7jtj1yHgoBSh+y/DajD0KF2G26+ycURILRaDg8bVkGwU7jtj1yHgoBSh+y/DajD0KF2G26+ycURILRaDg8bVkGwU7jtj1yHgoBSh+y/DajD0KF2G26+ycURILRaDg8bVkGwU7jtj1yHgoBSh+y/DajD0KF2G26+ycURILRaDg8Q==");

    loadNotifications();

    // Subscribe to new notifications
    const filterValue = !isAdmin && customerId ? `customer_id=eq.${customerId}` : undefined;
    const channel = supabase
      .channel(`notifications-${isAdmin ? "admin" : customerId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          ...(filterValue ? { filter: filterValue } : {}),
        },
        (payload) => {
          const newNotification = payload.new as Notification;
          
          // Filter realtime events by direction too
          const isCustomerToAdmin = CUSTOMER_TO_ADMIN_TYPES.includes(newNotification.type);
          if (isAdmin && !isCustomerToAdmin) return;
          if (!isAdmin && isCustomerToAdmin) return;
          
          setNotifications((prev) => [newNotification, ...prev]);

          if (audioRef.current) {
            audioRef.current.play().catch(() => {});
          }

          toast({
            title: "New Notification",
            description: newNotification.message,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [customerId, isAdmin, toast, loadNotifications]);

  const unreadCount = notifications.filter((n) => n.status !== "read").length;

  return { notifications, loading, unreadCount, markAsRead, markAllAsRead, refresh: loadNotifications };
};
