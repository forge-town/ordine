import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProfileSection } from "./ProfileSection";

describe("ProfileSection", () => {
  it("renders section title", () => {
    render(
      <ProfileSection
        saved={false}
        values={{ displayName: "Alice", email: "alice@example.com", bio: "" }}
        onChange={vi.fn()}
        onSave={vi.fn()}
      />,
    );
    expect(screen.getByText("个人信息")).toBeTruthy();
  });

  it("renders display name field", () => {
    render(
      <ProfileSection
        saved={false}
        values={{ displayName: "Alice", email: "alice@example.com", bio: "" }}
        onChange={vi.fn()}
        onSave={vi.fn()}
      />,
    );
    expect(screen.getByText("显示名称")).toBeTruthy();
  });
});
