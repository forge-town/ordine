import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AppearanceSection } from "./AppearanceSection";
import { SettingsStoreProvider } from "../../_store";

const renderWithStore = (initial = {}) =>
  render(
    <SettingsStoreProvider initialSettings={initial}>
      <AppearanceSection />
    </SettingsStoreProvider>
  );

describe("AppearanceSection", () => {
  it("renders theme title", () => {
    renderWithStore({ appearance: { theme: "light" } });
    expect(screen.getByText("外观")).toBeTruthy();
  });

  it("renders theme options", () => {
    renderWithStore({ appearance: { theme: "light" } });
    expect(screen.getByText("浅色")).toBeTruthy();
    expect(screen.getByText("深色")).toBeTruthy();
    expect(screen.getByText("跟随系统")).toBeTruthy();
  });
});
