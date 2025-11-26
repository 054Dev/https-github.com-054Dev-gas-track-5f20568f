import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Notification {
  id: string;
  message: string;
  type: string;
  created_at: string;
  status: string;
}

export const useNotifications = (customerId?: string) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const { toast } = useToast();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!customerId) return;

    // Initialize audio
    audioRef.current = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTcIG2m98OScTgwOUKnk77RgGwU7k9n0yXkpBSh+zPLaizsKGGS46+mcUBELTKXh8bllHAU2jdXzzn0vBSV8zPDdj0EKGV/A7emiUxILRaDh8bVjHAU5j9j1ynopBSh+zPDajDwKF2G36+uaUhIMSaDh8bVkGwU7jtj1yXkpBSh+y/DajD0KF2G26+ycURILRaDg8bVkGwU7jtj1yHgoBSh+y/DajD0KF2G26+ycURILRaDg8bVkGwU7jtj1yHgoBSh+y/DajD0KF2G26+ycURILRaDg8bVkGwU7jtj1yHgoBSh+y/DajD0KF2G26+ycURILRaDg8bVkGwU7jtj1yHgoBSh+y/DajD0KF2G26+ycURILRaDg8bVkGwU7jtj1yHgoBSh+y/DajD0KF2G26+ycURILRaDg8bVkGwU7jtj1yHgoBSh+y/DajD0KF2G26+ycURILRaDg8bVkGwU7jtj1yHgoBSh+y/DajD0KF2G26+ycURILRaDg8bVkGwU7jtj1yHgoBSh+y/DajD0KF2G26+ycURILRaDg8bVkGwU7jtj1yHgoBSh+y/DajD0KF2G26+ycURILRaDg8Q==");

    // Load existing notifications
    const loadNotifications = async () => {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false })
        .limit(10);

      if (data) setNotifications(data);
    };

    loadNotifications();

    // Subscribe to new notifications
    const channel = supabase
      .channel("notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `customer_id=eq.${customerId}`,
        },
        (payload) => {
          const newNotification = payload.new as Notification;
          console.log("New notification received:", newNotification);
          
          setNotifications((prev) => [newNotification, ...prev]);
          
          // Play notification sound
          if (audioRef.current) {
            audioRef.current.play().catch((e) => console.log("Audio play failed:", e));
          }

          // Show toast notification
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
  }, [customerId, toast]);

  return { notifications };
};
