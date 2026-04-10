import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SecuritySection } from "./SecuritySection";
import { SettingsStoreProvider } from "../../_store";

const renderWithStore = (initial = {}) =>
  render(
    <SettingsStoreProvider initialSettings={initial}>
      <SecuritySection />
    </SettingsStoreProvider>,
  );

describe("SecuritySection", () => {
  it("renders section title", () => {
    renderWithStore();
    expect(screen.getByText("安全")).toBeTruthy();
  });

  it("renders password fields", () => {
    renderWithStore();
    expect(screen.getByText("当前密码")).toBeTruthy();
    expect(screen.getByText("新密码")).toBeTruthy();
    expect(screen.getByText("确认新密码")).toBeTruthy();
  });
});
