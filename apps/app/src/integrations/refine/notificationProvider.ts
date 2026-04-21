import { type NotificationProvider } from "@refinedev/core";
import { toastStore } from "@/store/toastStore";

export const notificationProvider: NotificationProvider = {
  open: ({ message, description, type, key }) => {
    const { addToast } = toastStore.getState();

    addToast({
      id: key,
      type: type === "success" ? "success" : "error",
      title: message ?? "",
      description,
    });
  },
  close: (key) => {
    const { removeToast } = toastStore.getState();
    removeToast(key);
  },
};
