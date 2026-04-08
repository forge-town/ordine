import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SecuritySection } from "./SecuritySection";

describe("SecuritySection", () => {
  it("renders section title", () => {
    const handleChange = vi.fn();
    const handleSave = vi.fn();
    render(
      <SecuritySection
        saved={false}
        values={{ currentPassword: "", newPassword: "", confirmPassword: "" }}
        onChange={handleChange}
        onSave={handleSave}
      />
    );
    expect(screen.getByText("安全")).toBeTruthy();
  });

  it("renders password fields", () => {
    const handleChange = vi.fn();
    const handleSave = vi.fn();
    render(
      <SecuritySection
        saved={false}
        values={{ currentPassword: "", newPassword: "", confirmPassword: "" }}
        onChange={handleChange}
        onSave={handleSave}
      />
    );
    expect(screen.getByText("当前密码")).toBeTruthy();
    expect(screen.getByText("新密码")).toBeTruthy();
    expect(screen.getByText("确认新密码")).toBeTruthy();
  });
});
