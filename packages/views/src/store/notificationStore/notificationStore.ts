import { createContext, useContext } from "react";
import { createStore, type StoreApi } from "zustand";
import { persist } from "zustand/middleware";

export type NotificationPreference = "done" | "failed" | "waiting";
export type NotificationKind = "error" | "info" | "success" | "warning";

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  message: string;
  read: boolean;
  timestamp: number;
}

export interface NotificationState {
  preferences: Record<NotificationPreference, boolean>;
  notifications: AppNotification[];
  setPreference: (preference: NotificationPreference, enabled: boolean) => void;
  addNotification: (
    input: Omit<AppNotification, "id" | "read" | "timestamp"> & { id?: string },
  ) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clearNotifications: () => void;
}

export type NotificationStore = StoreApi<NotificationState>;
const MAX_NOTIFICATIONS = 60;

export const createNotificationStore = (): NotificationStore =>
  createStore<NotificationState>()(
    persist(
      (set) => ({
        preferences: { done: true, failed: true, waiting: true },
        notifications: [],
        setPreference: (preference, enabled) =>
          set((state) => ({
            preferences: { ...state.preferences, [preference]: enabled },
          })),
        addNotification: ({ id, kind, message }) =>
          set((state) => ({
            notifications: [
              {
                id: id ?? `notification-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                kind,
                message,
                read: false,
                timestamp: Date.now(),
              },
              ...state.notifications.filter((notification) => notification.id !== id),
            ].slice(0, MAX_NOTIFICATIONS),
          })),
        markRead: (id) =>
          set((state) => ({
            notifications: state.notifications.map((notification) =>
              notification.id === id ? { ...notification, read: true } : notification,
            ),
          })),
        markAllRead: () =>
          set((state) => ({
            notifications: state.notifications.map((notification) => ({
              ...notification,
              read: true,
            })),
          })),
        clearNotifications: () => set({ notifications: [] }),
      }),
      { name: "ordine.notifications" },
    ),
  );

export const NotificationStoreContext = createContext<NotificationStore | null>(null);

export const useNotificationStore = () => {
  const store = useContext(NotificationStoreContext);
  if (!store) {
    throw new Error("useNotificationStore must be used within NotificationStoreProvider");
  }

  return store;
};
