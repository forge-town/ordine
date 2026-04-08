import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SettingsPage } from "./SettingsPage";

vi.mock("@/components/AppLayout", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("./SettingsPageContent/SettingsPageContent", () => ({
  SettingsPageContent: () => <div>SettingsPageContent</div>,
}));

describe("SettingsPage", () => {
  it("renders SettingsPageContent inside AppLayout", () => {
    render(<SettingsPage />);
    expect(screen.getByText("SettingsPageContent")).toBeTruthy();
  });
});
