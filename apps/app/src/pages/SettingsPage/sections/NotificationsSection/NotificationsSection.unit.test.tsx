import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NotificationsSection } from "./NotificationsSection";
import { SettingsStoreProvider } from "../../_store";

const renderWithStore = (initial = {}) =>
  render(
    <SettingsStoreProvider initialSettings={initial}>
      <NotificationsSection />
    </SettingsStoreProvider>
  );

describe("NotificationsSection", () => {
  it("renders section title", () => {
    renderWithStore({
      notifications: { pipeline: true, mention: false, weekly: false },
    });
    expect(screen.getByText("通知")).toBeTruthy();
  });

  it("renders toggle labels", () => {
    renderWithStore({
      notifications: { pipeline: true, mention: false, weekly: false },
    });
    expect(screen.getByText("Pipeline 运行完成提醒")).toBeTruthy();
    expect(screen.getByText("每周摘要邮件")).toBeTruthy();
  });
});
