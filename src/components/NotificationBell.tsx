import { useState } from "react";
import { Bell, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import type { Notification } from "@/hooks/useNotifications";

interface NotificationBellProps {
  notifications: Notification[];
  unreadCount: number;
  onMarkAsRead?: (id: string) => void;
  onMarkAllAsRead?: () => void;
  notificationsPage?: string;
  showContactAdmin?: boolean;
}

export function NotificationBell({
  notifications,
  unreadCount,
  onMarkAsRead,
  onMarkAllAsRead,
  notificationsPage = "/customer/notifications",
  showContactAdmin = false,
}: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  // Sort latest first (defensive, in case data isn't pre-sorted)
  const sorted = [...notifications].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const handleContactAdmin = () => {
    setOpen(false);
    // Scroll to footer and trigger the contact dialog
    const footer = document.querySelector("footer");
    if (footer) {
      footer.scrollIntoView({ behavior: "smooth" });
      // Click the Contact button in the footer
      setTimeout(() => {
        const contactBtn = footer.querySelector<HTMLButtonElement>("button:last-of-type");
        contactBtn?.click();
      }, 400);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-8 w-8 md:h-10 md:w-10">
          <Bell className="h-4 w-4 md:h-5 md:w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Notifications</h3>
            <div className="flex gap-2">
              {unreadCount > 0 && onMarkAllAsRead && (
                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={onMarkAllAsRead}>
                  Mark all read
                </Button>
              )}
            </div>
          </div>
          <ScrollArea className="h-[280px]">
            {sorted.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No notifications yet
              </div>
            ) : (
              <div className="space-y-2">
                {sorted.slice(0, 8).map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-3 rounded-lg border transition-colors cursor-pointer ${
                      notification.status !== "read"
                        ? "bg-primary/5 border-primary/20"
                        : "bg-card hover:bg-accent"
                    }`}
                    onClick={() => onMarkAsRead?.(notification.id)}
                  >
                    <p className="text-sm line-clamp-2">{notification.message}</p>
                    <p className="text-xs text-muted-foreground/50 mt-1">
                      {format(new Date(notification.created_at), "MMM dd, yyyy 'at' h:mm a")}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
          <div className="flex flex-col gap-2">
            {showContactAdmin && (
              <Button
                variant="secondary"
                size="sm"
                className="w-full gap-2"
                onClick={handleContactAdmin}
              >
                <MessageCircle className="h-4 w-4" />
                Contact Admin
              </Button>
            )}
            {sorted.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => {
                  setOpen(false);
                  navigate(notificationsPage);
                }}
              >
                View All Notifications
              </Button>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
