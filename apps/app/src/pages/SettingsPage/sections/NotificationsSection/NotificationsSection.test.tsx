import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NotificationsSection } from "./NotificationsSection";

describe("NotificationsSection", () => {
  it("renders section title", () => {
    const handleChange = vi.fn();
    const handleSave = vi.fn();
    render(
      <NotificationsSection
        saved={false}
        values={{ pipeline: true, mention: false, weekly: false }}
        onChange={handleChange}
        onSave={handleSave}
      />
    );
    expect(screen.getByText("通知")).toBeTruthy();
  });

  it("renders toggle labels", () => {
    const handleChange = vi.fn();
    const handleSave = vi.fn();
    render(
      <NotificationsSection
        saved={false}
        values={{ pipeline: true, mention: false, weekly: false }}
        onChange={handleChange}
        onSave={handleSave}
      />
    );
    expect(screen.getByText("Pipeline 运行完成提醒")).toBeTruthy();
    expect(screen.getByText("每周摘要邮件")).toBeTruthy();
  });
});
