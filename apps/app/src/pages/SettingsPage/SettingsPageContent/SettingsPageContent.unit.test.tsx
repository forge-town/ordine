import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SettingsPageContent } from "./SettingsPageContent";

vi.mock("../sections", () => ({
  AppearanceSection: () => <div>AppearanceSection</div>,
  LanguageSection: () => <div>LanguageSection</div>,
  NotificationsSection: () => <div>NotificationsSection</div>,
  ProfileSection: () => <div>ProfileSection</div>,
  SecuritySection: () => <div>SecuritySection</div>,
}));

describe("SettingsPageContent", () => {
  it("renders settings header", () => {
    render(<SettingsPageContent />);
    expect(screen.getByText("设置")).toBeTruthy();
  });

  it("renders navigation sidebar items", () => {
    render(<SettingsPageContent />);
    expect(screen.getByText("个人信息")).toBeTruthy();
    expect(screen.getByText("通知")).toBeTruthy();
    expect(screen.getByText("外观")).toBeTruthy();
    expect(screen.getByText("语言与地区")).toBeTruthy();
    expect(screen.getByText("安全")).toBeTruthy();
  });

  it("renders ProfileSection by default", () => {
    render(<SettingsPageContent />);
    expect(screen.getByText("ProfileSection")).toBeTruthy();
  });
});
