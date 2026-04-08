import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProfileSection } from "./ProfileSection";

describe("ProfileSection", () => {
  it("renders section title", () => {
    const handleChange = vi.fn();
    const handleSave = vi.fn();
    render(
      <ProfileSection
        saved={false}
        values={{ displayName: "Alice", email: "alice@example.com", bio: "" }}
        onChange={handleChange}
        onSave={handleSave}
      />
    );
    expect(screen.getByText("个人信息")).toBeTruthy();
  });

  it("renders display name field", () => {
    const handleChange = vi.fn();
    const handleSave = vi.fn();
    render(
      <ProfileSection
        saved={false}
        values={{ displayName: "Alice", email: "alice@example.com", bio: "" }}
        onChange={handleChange}
        onSave={handleSave}
      />
    );
    expect(screen.getByText("显示名称")).toBeTruthy();
  });
});
