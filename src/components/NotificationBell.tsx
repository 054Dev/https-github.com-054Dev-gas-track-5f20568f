import { useState, useRef, useEffect, useCallback } from "react";
import { Bell, MessageCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { Clock, User, MessageSquare } from "lucide-react";
import type { Notification } from "@/hooks/useNotifications";

interface NotificationBellProps {
  notifications: Notification[];
  unreadCount: number;
  onMarkAsRead?: (id: string) => void;
  onMarkAllAsRead?: () => void;
  notificationsPage?: string;
  showContactAdmin?: boolean;
  showSendNotification?: boolean;
  onSendNotification?: () => void;
}

function DropdownNotificationItem({
  notification,
  onMarkAsRead,
  onOpenDetail,
}: {
  notification: Notification;
  onMarkAsRead?: (id: string) => void;
  onOpenDetail: (n: Notification) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);
  const isUnread = notification.status !== "read";

  // Detect if text is truncated (line-clamp) — delay to let popover animate in
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!ref.current) return;
      const el = ref.current.querySelector<HTMLParagraphElement>("[data-msg]");
      if (el) {
        setIsTruncated(el.scrollHeight > el.clientHeight + 1);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [notification.message]);

  // Auto-mark as read if NOT truncated and unread
  useEffect(() => {
    if (!isUnread || isTruncated) return;
    const timer = setTimeout(() => {
      onMarkAsRead?.(notification.id);
    }, 600);
    return () => clearTimeout(timer);
  }, [isUnread, isTruncated, notification.id, onMarkAsRead]);

  const handleClick = () => {
    onOpenDetail(notification);
    // If truncated & unread, mark as read on open
    if (isUnread) {
      onMarkAsRead?.(notification.id);
    }
  };

  return (
    <div
      ref={ref}
      onClick={handleClick}
      className={`p-3 rounded-lg border transition-colors cursor-pointer ${
        isUnread
          ? "bg-primary/5 border-primary/20"
          : "bg-card hover:bg-accent"
      }`}
    >
      <p data-msg className="text-sm line-clamp-2">{notification.message}</p>
      <p className="text-xs text-muted-foreground/50 mt-1">
        {format(new Date(notification.created_at), "MMM dd, h:mm a")}
      </p>
    </div>
  );
}

function NotificationDetailDialog({
  notification,
  open,
  onOpenChange,
  senderName,
}: {
  notification: Notification | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  senderName?: string;
}) {
  if (!notification) return null;

  const typeLabel = notification.type.replace(/_/g, " ");

  const parseContactMessage = (message: string) => {
    const lines = message.split("\n");
    const fields: Record<string, string> = {};
    let messageBody = "";
    let inMessage = false;

    for (const line of lines) {
      if (line.startsWith("Message:")) {
        inMessage = true;
        continue;
      }
      if (inMessage) {
        messageBody += (messageBody ? "\n" : "") + line;
        continue;
      }
      const colonIdx = line.indexOf(":");
      if (colonIdx > 0) {
        const key = line.substring(0, colonIdx).trim();
        const value = line.substring(colonIdx + 1).trim();
        if (key && value) fields[key] = value;
      }
    }

    return { fields, messageBody: messageBody.trim() || message };
  };

  const parsed = notification.type === "contact_request"
    ? parseContactMessage(notification.message)
    : null;

  const isUnread = notification.status !== "read";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-md mx-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            Notification Details
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="capitalize">
              {typeLabel}
            </Badge>
            {isUnread && (
              <Badge variant="default" className="text-xs">Unread</Badge>
            )}
          </div>

          <Separator />

          {senderName && (
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <User className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">From</p>
                <p className="text-sm text-muted-foreground">{senderName}</p>
              </div>
            </div>
          )}

          {parsed && Object.keys(parsed.fields).length > 0 && (
            <div className="space-y-2 bg-muted/50 rounded-lg p-3">
              {Object.entries(parsed.fields).map(([key, value]) => (
                <div key={key} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{key}</span>
                  <span className="font-medium text-foreground">{value}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-full bg-accent flex items-center justify-center shrink-0">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium mb-1">Message</p>
              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                {parsed ? parsed.messageBody : notification.message}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 justify-end mt-2">
          <Clock className="h-3 w-3 text-muted-foreground/40" />
          <span className="text-xs text-muted-foreground/40">
            {format(new Date(notification.created_at), "EEEE, MMM dd, yyyy 'at' h:mm a")}
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function NotificationBell({
  notifications,
  unreadCount,
  onMarkAsRead,
  onMarkAllAsRead,
  notificationsPage = "/customer/notifications",
  showContactAdmin = false,
  showSendNotification = false,
  onSendNotification,
}: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const navigate = useNavigate();

  const sorted = [...notifications].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const handleOpenDetail = useCallback((n: Notification) => {
    setSelectedNotification(n);
    setDetailOpen(true);
  }, []);

  const handleContactAdmin = () => {
    setOpen(false);
    const footer = document.querySelector("footer");
    if (footer) {
      footer.scrollIntoView({ behavior: "smooth" });
      setTimeout(() => {
        const contactBtn = footer.querySelector<HTMLButtonElement>("button:last-of-type");
        contactBtn?.click();
      }, 400);
    }
  };

  const handleSendNotification = () => {
    setOpen(false);
    onSendNotification?.();
  };

  return (
    <>
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
                    <DropdownNotificationItem
                      key={notification.id}
                      notification={notification}
                      onMarkAsRead={onMarkAsRead}
                      onOpenDetail={handleOpenDetail}
                    />
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
              {showSendNotification && (
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full gap-2"
                  onClick={handleSendNotification}
                >
                  <Send className="h-4 w-4" />
                  Send Notification
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

      <NotificationDetailDialog
        notification={selectedNotification}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </>
  );
}
