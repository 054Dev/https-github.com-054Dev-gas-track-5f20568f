import { NotificationBell } from "@/components/NotificationBell";
import { useNotifications } from "@/hooks/useNotifications";

interface CustomerNotificationBellProps {
  customerId: string;
}

export function CustomerNotificationBell({ customerId }: CustomerNotificationBellProps) {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications({ customerId });

  return (
    <NotificationBell
      notifications={notifications}
      unreadCount={unreadCount}
      onMarkAsRead={markAsRead}
      onMarkAllAsRead={markAllAsRead}
      notificationsPage="/customer/notifications"
      showContactAdmin
    />
  );
}
