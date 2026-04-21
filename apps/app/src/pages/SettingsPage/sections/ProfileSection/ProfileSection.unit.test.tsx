import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProfileSection } from "./ProfileSection";
import { SettingsStoreProvider } from "../../_store";

const renderWithStore = (initial = {}) =>
  render(
    <SettingsStoreProvider initialSettings={initial}>
      <ProfileSection />
    </SettingsStoreProvider>
  );

describe("ProfileSection", () => {
  it("renders section title", () => {
    renderWithStore({
      profile: { displayName: "Alice", email: "alice@example.com", bio: "" },
    });
    expect(screen.getByText("个人信息")).toBeTruthy();
  });

  it("renders display name field", () => {
    renderWithStore({
      profile: { displayName: "Alice", email: "alice@example.com", bio: "" },
    });
    expect(screen.getByText("显示名称")).toBeTruthy();
  });
});
