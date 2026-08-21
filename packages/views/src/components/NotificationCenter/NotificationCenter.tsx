import { useState } from "react";
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
import { useStore } from "zustand";
import { Button } from "@repo/ui/button";
import { cn } from "@repo/ui/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui/popover";
import { type NotificationKind, useNotificationStore } from "../../store/notificationStore";

const KIND_ICON: Record<NotificationKind, { className: string; icon: LucideIcon }> = {
  error: { className: "text-destructive", icon: CircleAlert },
  info: { className: "text-muted-foreground", icon: Info },
  success: { className: "text-success", icon: CircleCheck },
  warning: { className: "text-warning", icon: TriangleAlert },
};

const RELATIVE_TIME_UNITS = [
  { limit: 60, unit: "second" },
  { limit: 60, unit: "minute" },
  { limit: 24, unit: "hour" },
  { limit: 7, unit: "day" },
  { limit: 4.345, unit: "week" },
  { limit: 12, unit: "month" },
] as const;

const formatRelativeTime = (timestamp: number, locale: string) => {
  const seconds = (timestamp - Date.now()) / 1000;
  const candidates = RELATIVE_TIME_UNITS.map(({ limit, unit }, index) => ({
    limit,
    unit,
    value:
      seconds / RELATIVE_TIME_UNITS.slice(0, index).reduce((total, item) => total * item.limit, 1),
  }));
  const selected = candidates.find(({ limit, value }) => Math.abs(value) < limit);
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  if (selected) return formatter.format(Math.round(selected.value), selected.unit);

  return formatter.format(
    Math.round(seconds / RELATIVE_TIME_UNITS.reduce((total, item) => total * item.limit, 1)),
    "year",
  );
};

export interface NotificationCenterProps {
  className?: string;
  variant?: "rail" | "sidebar";
}

export const NotificationCenter = ({ className, variant = "sidebar" }: NotificationCenterProps) => {
  const { i18n, t } = useTranslation();
  const navigate = useNavigate();
  const store = useNotificationStore();
  const notifications = useStore(store, (state) => state.notifications);
  const clearNotifications = useStore(store, (state) => state.clearNotifications);
  const markAllRead = useStore(store, (state) => state.markAllRead);
  const markRead = useStore(store, (state) => state.markRead);
  const [open, setOpen] = useState(false);
  const unreadCount = notifications.filter((notification) => !notification.read).length;
  const triggerLabel =
    unreadCount > 0 ? `${t("notifications.title")} (${unreadCount})` : t("notifications.title");
  const handleOpenChange = (value: boolean) => setOpen(value);
  const handleMarkAllRead = () => markAllRead();
  const handleClearNotifications = () => clearNotifications();
  const handleNotificationClick = (id: string, route?: string) => () => {
    markRead(id);
    setOpen(false);
    if (route) {
      void navigate({ to: route });
    }
  };

  return (
    <div className={cn("min-w-0", className)} data-testid="notification-center">
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger
          aria-label={triggerLabel}
          className={cn(
            "relative flex items-center text-foreground/70 outline-none transition-colors hover:bg-sidebar-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring",
            variant === "rail"
              ? "size-9 justify-center rounded-md"
              : "h-8 w-full gap-2 overflow-hidden rounded-md px-2 text-left text-sm group-data-[collapsible=icon]/sidebar:size-8! group-data-[collapsible=icon]/sidebar:p-2!",
          )}
          data-testid="notification-bell"
        >
          <Bell className="size-4" />
          {variant === "sidebar" ? (
            <span className="truncate group-data-[collapsible=icon]/sidebar:hidden">
              {t("notifications.title")}
            </span>
          ) : null}
          {unreadCount > 0 ? (
            <span
              className={cn(
                "absolute flex min-h-4 min-w-4 items-center justify-center rounded-full bg-foreground px-1 text-[9px] font-bold text-background",
                variant === "rail"
                  ? "-right-1 -top-1"
                  : "right-2 group-data-[collapsible=icon]/sidebar:-right-1 group-data-[collapsible=icon]/sidebar:-top-1",
              )}
              data-testid="notification-unread"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          ) : null}
        </PopoverTrigger>

        <PopoverContent
          align="end"
          className="w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden p-0 shadow-float"
          side="right"
          sideOffset={8}
        >
          <div className="flex min-h-11 items-center gap-2 border-b px-3.5">
            <Bell className="size-4 text-foreground/75" />
            <span className="text-sm font-semibold">{t("notifications.title")}</span>
            <span className="rounded-full bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              {notifications.length}
            </span>
            <div className="ml-auto flex items-center gap-1">
              <Button
                data-testid="notification-mark-read"
                disabled={unreadCount === 0}
                size="xs"
                type="button"
                variant="ghost"
                onClick={handleMarkAllRead}
              >
                {t("notifications.markRead")}
              </Button>
              <Button
                aria-label={t("notifications.clear")}
                data-testid="notification-clear"
                disabled={notifications.length === 0}
                size="icon-xs"
                type="button"
                variant="ghost"
                onClick={handleClearNotifications}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          </div>

          <div className="max-h-[min(24rem,60vh)] overflow-y-auto py-1">
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
                    key={notification.id}
                    className={cn(
                      "flex w-full items-start gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-accent/60",
                      notification.read && "opacity-60",
                    )}
                    data-testid={`notification-item-${notification.id}`}
                    type="button"
                    onClick={handleNotificationClick(notification.id, notification.route)}
                  >
                    <meta.icon className={cn("mt-0.5 size-4 shrink-0", meta.className)} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs leading-snug text-foreground/90">
                        {notification.message}
                      </span>
                      <span className="mt-0.5 block text-[10px] text-muted-foreground">
                        {formatRelativeTime(notification.timestamp, i18n.language)}
                        {notification.route ? ` · ${t("notifications.open")}` : ""}
                      </span>
                    </span>
                    {notification.read ? null : (
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-foreground" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};
