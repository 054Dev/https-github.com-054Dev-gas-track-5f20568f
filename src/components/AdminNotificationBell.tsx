import { NotificationBell } from "@/components/NotificationBell";
import { useNotifications } from "@/hooks/useNotifications";

export function AdminNotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications({ isAdmin: true });

  return (
    <NotificationBell
      notifications={notifications}
      unreadCount={unreadCount}
      onMarkAsRead={markAsRead}
      onMarkAllAsRead={markAllAsRead}
      notificationsPage="/admin/notifications"
    />
  );
}
