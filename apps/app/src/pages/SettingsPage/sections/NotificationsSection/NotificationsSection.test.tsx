import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NotificationsSection } from "./NotificationsSection";

describe("NotificationsSection", () => {
  it("renders section title", () => {
    render(
      <NotificationsSection
        saved={false}
        values={{ pipeline: true, mention: false, weekly: false }}
        onChange={vi.fn()}
        onSave={vi.fn()}
      />,
    );
    expect(screen.getByText("通知")).toBeTruthy();
  });

  it("renders toggle labels", () => {
    render(
      <NotificationsSection
        saved={false}
        values={{ pipeline: true, mention: false, weekly: false }}
        onChange={vi.fn()}
        onSave={vi.fn()}
      />,
    );
    expect(screen.getByText("Pipeline 运行完成提醒")).toBeTruthy();
    expect(screen.getByText("每周摘要邮件")).toBeTruthy();
  });
});
