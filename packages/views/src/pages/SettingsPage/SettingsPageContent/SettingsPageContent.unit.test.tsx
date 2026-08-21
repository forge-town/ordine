import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
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
    expect(
      screen.queryByText("配置工作区默认项、自主性、通知与本地开发环境。"),
    ).not.toBeInTheDocument();
  });

  it("renders navigation sidebar items", () => {
    render(<SettingsPageContent />);
    expect(screen.getByText("语言与地区")).toBeTruthy();
    expect(screen.getByText("通知")).toBeTruthy();
    expect(screen.getByText("默认项")).toBeTruthy();
    expect(screen.getByText("项目")).toBeTruthy();
  });

  it("renders LanguageSection by default", () => {
    render(<SettingsPageContent />);
    expect(screen.getByText("LanguageSection")).toBeTruthy();
  });

  it("switches sections from the navigation", () => {
    render(<SettingsPageContent />);
    fireEvent.click(screen.getByTestId("settings-nav-defaults"));
    expect(screen.getByText("DefaultsSection")).toBeTruthy();
  });

  it("opens keyboard help", () => {
    render(<SettingsPageContent />);
    fireEvent.click(screen.getByTestId("settings-keyboard-help"));
    expect(screen.getByText("KeyboardSection")).toBeTruthy();
  });
});
