import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SettingsPageContent } from "./SettingsPageContent";

vi.mock("../sections", () => ({
  AdvancedSection: () => <div>AdvancedSection</div>,
  AutonomySection: () => <div>AutonomySection</div>,
  DefaultsSection: () => <div>DefaultsSection</div>,
  DeveloperSection: () => <div>DeveloperSection</div>,
  KeyboardSection: () => <div>KeyboardSection</div>,
  LanguageSection: () => <div>LanguageSection</div>,
  NotificationsSection: () => <div>NotificationsSection</div>,
  ProjectSection: () => <div>ProjectSection</div>,
}));

describe("SettingsPageContent", () => {
  it("renders settings header", () => {
    render(<SettingsPageContent />);
    expect(screen.getByText("设置")).toBeTruthy();
  });

  it("renders navigation sidebar items", () => {
    render(<SettingsPageContent />);
    expect(screen.getByText("语言与地区")).toBeTruthy();
  });

  it("renders LanguageSection by default", () => {
    render(<SettingsPageContent />);
    expect(screen.getByText("LanguageSection")).toBeTruthy();
  });
});
