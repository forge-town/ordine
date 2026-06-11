import { beforeEach, describe, expect, it } from "vitest";
import { toastStore } from "../toastStore/toastStore";
import { useNotificationStore } from "./notificationStore";

describe("notificationStore", () => {
  beforeEach(() => {
    useNotificationStore.getState().clearNotifications();
  });

  it("records, marks read, and clears notifications", () => {
    useNotificationStore.getState().addNotification({
      kind: "success",
      message: "job_1 completed",
      route: "/jobs",
    });
    useNotificationStore.getState().addNotification({
      kind: "error",
      message: "Connector needs a token",
    });

    expect(useNotificationStore.getState().notifications).toHaveLength(2);
    expect(useNotificationStore.getState().notifications.filter((item) => !item.read)).toHaveLength(
      2,
    );

    useNotificationStore.getState().markAllRead();
    expect(useNotificationStore.getState().notifications.filter((item) => !item.read)).toHaveLength(
      0,
    );

    useNotificationStore.getState().clearNotifications();
    expect(useNotificationStore.getState().notifications).toHaveLength(0);
  });

  it("mirrors toasts into the history", () => {
    toastStore.getState().addToast({ title: "Run started", type: "success" });

    const latest = useNotificationStore.getState().notifications[0];
    expect(latest?.message).toBe("Run started");
    expect(latest?.kind).toBe("success");
  });

  it("caps the history at 60 entries", () => {
    for (const index of Array.from({ length: 70 }, (_, i) => i)) {
      useNotificationStore.getState().addNotification({
        kind: "info",
        message: `event ${index}`,
      });
    }

    expect(useNotificationStore.getState().notifications).toHaveLength(60);
    expect(useNotificationStore.getState().notifications[0]?.message).toBe("event 69");
  });
});
