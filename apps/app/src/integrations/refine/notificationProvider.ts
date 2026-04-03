import { type NotificationProvider } from "@refinedev/core";
import { useToastStore } from "@/hooks/useToastStore";

export const notificationProvider: NotificationProvider = {
  open: ({ message, description, type, key }) => {
    const { addToast } = useToastStore.getState();

    addToast({
      id: key,
      type: type === "success" ? "success" : "error",
      title: message ?? "",
      description,
    });
  },
  close: (key) => {
    const { removeToast } = useToastStore.getState();
    removeToast(key);
  },
};
