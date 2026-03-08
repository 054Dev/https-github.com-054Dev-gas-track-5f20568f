import { useRef, useEffect, useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Bell, User, Clock, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import type { Notification } from "@/hooks/useNotifications";

interface NotificationItemProps {
  notification: Notification;
  senderName?: string;
  onMarkAsRead: (id: string) => void;
}

export function NotificationItem({ notification, senderName, onMarkAsRead }: NotificationItemProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const isUnread = notification.status !== "read";

  // Auto-mark as read when scrolled into view
  useEffect(() => {
    if (!isUnread || !ref.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // Small delay so the user actually sees the unread state briefly
          const timer = setTimeout(() => {
            onMarkAsRead(notification.id);
          }, 800);
          observer.disconnect();
          return () => clearTimeout(timer);
        }
      },
      { threshold: 0.6 }
    );

    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [isUnread, notification.id, onMarkAsRead]);

  const typeLabel = notification.type.replace(/_/g, " ");

  // Parse contact_request messages for structured display
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

  return (
    <>
      <div
        ref={ref}
        onClick={() => setDetailOpen(true)}
        className={`group relative flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-all hover:shadow-md ${
          isUnread
            ? "border-primary/30 bg-primary/5 hover:bg-primary/10"
            : "border-border bg-card hover:bg-accent"
        }`}
      >
        {/* Unread indicator dot */}
        {isUnread && (
          <span className="absolute left-1.5 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-primary" />
        )}

        <div className="flex-1 min-w-0 ml-1">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <Badge variant={isUnread ? "default" : "secondary"} className="text-xs capitalize">
              {typeLabel}
            </Badge>
            {senderName && (
              <span className="text-xs font-medium text-muted-foreground truncate">
                {senderName}
              </span>
            )}
          </div>
          <p className="text-sm truncate text-foreground">
            {parsed ? parsed.messageBody : notification.message}
          </p>
        </div>

        <span className="text-xs text-muted-foreground/60 whitespace-nowrap shrink-0">
          {format(new Date(notification.created_at), "MMM dd, h:mm a")}
        </span>
      </div>

      {/* Detail popup */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="w-[95vw] max-w-md mx-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              Notification Details
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Type badge */}
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="capitalize">
                {typeLabel}
              </Badge>
              {isUnread && (
                <Badge variant="default" className="text-xs">Unread</Badge>
              )}
            </div>

            <Separator />

            {/* Sender info */}
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

            {/* Parsed fields for contact requests */}
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

            {/* Message body */}
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

          {/* Faded timestamp at bottom corner */}
          <div className="flex items-center gap-1.5 justify-end mt-2">
            <Clock className="h-3 w-3 text-muted-foreground/40" />
            <span className="text-xs text-muted-foreground/40">
              {format(new Date(notification.created_at), "EEEE, MMM dd, yyyy 'at' h:mm a")}
            </span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
