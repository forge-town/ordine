import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * N18-04：通知偏好（原型 settings.jsx Notifications 组）。
 * 通知本身是前端 store（notificationStore），偏好同样留在前端持久化。
 * cancelled/expired 等少见终态不受偏好控制（始终提示）。
 */

export type NotificationPrefKey = "done" | "failed" | "waiting";

type NotificationPrefsState = {
  done: boolean;
  failed: boolean;
  waiting: boolean;
  setPref: (key: NotificationPrefKey, value: boolean) => void;
};

export const useNotificationPrefsStore = create<NotificationPrefsState>()(
  persist(
    (set) => ({
      done: true,
      failed: true,
      waiting: true,
      setPref: (key, value) => set({ [key]: value }),
    }),
    { name: "ordine.notification-prefs" },
  ),
);
