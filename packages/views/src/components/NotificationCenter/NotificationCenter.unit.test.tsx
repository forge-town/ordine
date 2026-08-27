import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "../../test/test-wrapper";
import { createNotificationStore, NotificationStoreContext } from "../../store/notificationStore";
import { NotificationCenter } from "./NotificationCenter";

const renderNotificationCenter = () => {
  const store = createNotificationStore();
  store.setState({
    notifications: [
      {
        id: "job-failed",
        kind: "error",
        message: "Pipeline run failed",
        read: false,
        timestamp: Date.now() - 60_000,
      },
      {
        id: "run-done",
        kind: "success",
        message: "Pipeline run completed",
        read: true,
        timestamp: Date.now() - 3_600_000,
      },
    ],
  });

  render(
    <NotificationStoreContext.Provider value={store}>
      <NotificationCenter />
    </NotificationStoreContext.Provider>,
  );

  return store;
};

describe("NotificationCenter", () => {
  it("shows unread history and marks a selected item read", async () => {
    const user = userEvent.setup();
    const store = renderNotificationCenter();

    expect(screen.getByTestId("notification-center")).not.toHaveClass("fixed");
    expect(screen.getByTestId("notification-bell")).toHaveAccessibleName("Notifications (1)");

    await user.click(screen.getByTestId("notification-bell"));
    expect(screen.getByText("Pipeline run failed")).toBeInTheDocument();
    expect(screen.getByTestId("notification-unread")).toHaveTextContent("1");

    await user.click(screen.getByTestId("notification-item-job-failed"));

    expect(store.getState().notifications[0]?.read).toBe(true);
  });

  it("marks all notifications read and clears history", async () => {
    const user = userEvent.setup();
    const store = renderNotificationCenter();

    await user.click(screen.getByTestId("notification-bell"));
    await user.click(screen.getByTestId("notification-mark-read"));
    expect(store.getState().notifications.every((notification) => notification.read)).toBe(true);

    await user.click(screen.getByTestId("notification-clear"));
    expect(store.getState().notifications).toEqual([]);
    expect(screen.getByText("All clear")).toBeInTheDocument();
  });
});
