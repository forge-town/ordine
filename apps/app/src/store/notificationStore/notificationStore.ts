import { create } from "zustand";

export type NotificationKind = "error" | "info" | "success" | "warn";

export type AppNotification = {
  id: string;
  kind: NotificationKind;
  message: string;
  read: boolean;
  route?: string;
  ts: number;
};

export type NotificationState = {
  notifications: AppNotification[];
  addNotification: (input: {
    id?: string;
    kind: NotificationKind;
    message: string;
    route?: string;
  }) => void;
  clearNotifications: () => void;
  markAllRead: () => void;
};

const MAX_NOTIFICATIONS = 60;

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  addNotification: ({ id, kind, message, route }) =>
    set((state) => ({
      notifications: [
        {
          id: id ?? `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          kind,
          message,
          read: false,
          route,
          ts: Date.now(),
        },
        ...state.notifications,
      ].slice(0, MAX_NOTIFICATIONS),
    })),
  clearNotifications: () => set({ notifications: [] }),
  markAllRead: () =>
    set((state) => ({
      notifications: state.notifications.map((notification) => ({
        ...notification,
        read: true,
      })),
    })),
}));
