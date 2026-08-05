import { describe, expect, it } from "vitest";
import { createNotificationStore } from "./notificationStore";

describe("notificationStore", () => {
  it("updates preferences without changing the others", () => {
    const store = createNotificationStore();

    store.getState().setPreference("waiting", false);

    expect(store.getState().preferences).toEqual({ done: true, failed: true, waiting: false });
  });

  it("records, marks read, clears, and caps notification history", () => {
    const store = createNotificationStore();
    for (const index of Array.from({ length: 70 }, (_, itemIndex) => itemIndex)) {
      store.getState().addNotification({ kind: "info", message: `event ${index}` });
    }

    expect(store.getState().notifications).toHaveLength(60);
    expect(store.getState().notifications[0]?.message).toBe("event 69");

    const newestId = store.getState().notifications[0]?.id;
    expect(newestId).toBeDefined();
    store.getState().markRead(newestId!);
    expect(store.getState().notifications[0]?.read).toBe(true);
    expect(store.getState().notifications[1]?.read).toBe(false);

    store.getState().markAllRead();
    expect(store.getState().notifications.every((notification) => notification.read)).toBe(true);

    store.getState().clearNotifications();
    expect(store.getState().notifications).toEqual([]);
  });
});
