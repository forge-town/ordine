import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SettingsPage } from "./SettingsPage";

vi.mock("./SettingsPageContent/SettingsPageContent", () => ({
  SettingsPageContent: () => <div>SettingsPageContent</div>,
}));

Object.defineProperty(globalThis, "localStorage", {
  value: { getItem: vi.fn(() => null), setItem: vi.fn() },
  writable: true,
});

describe("SettingsPage", () => {
  it("renders SettingsPageContent", () => {
    render(<SettingsPage />);
    expect(screen.getByText("SettingsPageContent")).toBeTruthy();
  });
});
