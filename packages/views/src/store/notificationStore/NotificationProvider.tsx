import { useEffect, type ReactNode } from "react";
import { useInit } from "../../hooks/useInit";
import {
  createNotificationStore,
  NotificationStoreContext,
  useNotificationStore,
} from "./notificationStore";

type ToastSnapshot = {
  toasts: Array<{
    id: string;
    type: "success" | "error";
    title: string;
    description?: string;
  }>;
};

export const ToastNotificationBridge = <State extends ToastSnapshot>({
  toastStore,
}: {
  toastStore: {
    subscribe: (listener: (state: State, previousState: State) => void) => () => void;
  };
}) => {
  const notifications = useNotificationStore();

  useEffect(
    () =>
      toastStore.subscribe((state, previousState) => {
        const previousIds = new Set(previousState.toasts.map((toast) => toast.id));
        for (const toast of state.toasts.filter((item) => !previousIds.has(item.id))) {
          notifications.getState().addNotification({
            id: `toast-${toast.id}`,
            kind: toast.type,
            message: toast.description ? `${toast.title}: ${toast.description}` : toast.title,
          });
        }
      }),
    [notifications, toastStore],
  );

  return null;
};

export const NotificationStoreProvider = ({ children }: { children: ReactNode }) => {
  const store = useInit(createNotificationStore);

  return (
    <NotificationStoreContext.Provider value={store}>{children}</NotificationStoreContext.Provider>
  );
};
