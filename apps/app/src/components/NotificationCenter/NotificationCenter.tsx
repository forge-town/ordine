import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Bell,
  BellOff,
  CircleAlert,
  CircleCheck,
  Info,
  Trash2,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@repo/ui/lib/utils";
import { timeAgo } from "@/lib/format";
import { useNotificationStore, type NotificationKind } from "@/store/notificationStore";

const KIND_ICON: Record<NotificationKind, { className: string; icon: LucideIcon }> = {
  error: { className: "text-destructive", icon: CircleAlert },
  info: { className: "text-muted-foreground", icon: Info },
  success: { className: "text-success", icon: CircleCheck },
  warn: { className: "text-warning", icon: TriangleAlert },
};

/** Reviewable history for run / self-heal / connector events (prototype shell.jsx). */
export const NotificationCenter = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const notifications = useNotificationStore((state) => state.notifications);
  const clearNotifications = useNotificationStore((state) => state.clearNotifications);
  const markAllRead = useNotificationStore((state) => state.markAllRead);
  const unreadCount = notifications.filter((notification) => !notification.read).length;

  useEffect(() => {
    if (!open) {
      return;
    }
    const handlePointerDown = (event: globalThis.PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("pointerdown", handlePointerDown);

    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  return (
    <div className="fixed right-3 top-3 z-50" data-testid="notification-center" ref={containerRef}>
      <button
        aria-label={t("notifications.title")}
        className="relative rounded-lg bg-surface p-1.5 text-muted-foreground shadow-soft ring-1 ring-border transition-colors hover:bg-accent/60 hover:text-foreground"
        data-testid="notification-bell"
        type="button"
        onClick={() => setOpen((value) => !value)}
      >
        <Bell className="size-3.5" />
        {unreadCount > 0 ? (
          <span
            className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-foreground px-1 text-[8.5px] font-bold text-background"
            data-testid="notification-unread"
          >
            {unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          className="absolute right-0 top-9 w-80 overflow-hidden rounded-2xl bg-surface shadow-float ring-1 ring-border-strong"
          data-testid="notification-panel"
        >
          <div className="flex items-center gap-2 border-b border-border/70 px-3.5 py-2.5">
            <Bell className="size-3.5 text-foreground/75" />
            <span className="text-xs font-semibold">{t("notifications.title")}</span>
            <span className="rounded-full bg-surface-2 px-1.5 py-0.5 font-mono text-[9.5px] text-muted-foreground">
              {notifications.length}
            </span>
            <div className="ml-auto flex items-center gap-1">
              <button
                className="rounded-lg px-1.5 py-1 text-[10.5px] text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                data-testid="notification-mark-read"
                type="button"
                onClick={markAllRead}
              >
                {t("notifications.markRead")}
              </button>
              <button
                aria-label={t("notifications.clear")}
                className="rounded-lg p-1 text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                data-testid="notification-clear"
                type="button"
                onClick={clearNotifications}
              >
                <Trash2 className="size-3" />
              </button>
            </div>
          </div>
          <div className="max-h-[360px] overflow-y-auto py-1">
            {notifications.length === 0 ? (
              <div className="grid place-items-center px-4 py-10 text-center">
                <BellOff className="size-5 text-muted-foreground/50" />
                <div className="mt-2 text-xs font-medium">{t("notifications.emptyTitle")}</div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">
                  {t("notifications.emptyBody")}
                </div>
              </div>
            ) : (
              notifications.map((notification) => {
                const meta = KIND_ICON[notification.kind];

                return (
                  <button
                    className={cn(
                      "flex w-full items-start gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-accent/40",
                      notification.read && "opacity-60",
                    )}
                    data-testid={`notification-item-${notification.id}`}
                    key={notification.id}
                    type="button"
                    onClick={() => {
                      if (notification.route) {
                        void navigate({ to: notification.route });
                      }
                      setOpen(false);
                    }}
                  >
                    <meta.icon className={cn("mt-0.5 size-3.5 shrink-0", meta.className)} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs leading-snug text-foreground/90">
                        {notification.message}
                      </span>
                      <span className="mt-0.5 block text-[10px] text-muted-foreground">
                        {timeAgo(notification.ts)}
                        {notification.route ? ` · ${t("notifications.open")}` : ""}
                      </span>
                    </span>
                    {!notification.read ? (
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-foreground" />
                    ) : null}
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};
