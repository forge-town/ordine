import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SettingsPageContent } from "./SettingsPageContent";

vi.mock("../sections", () => ({
  DeveloperSection: () => <div>DeveloperSection</div>,
  GeneralSection: () => <div>GeneralSection</div>,
  LanguageSection: () => <div>LanguageSection</div>,
}));

describe("SettingsPageContent", () => {
  it("renders settings header", () => {
    render(<SettingsPageContent />);
    expect(screen.getByText("设置")).toBeTruthy();
  });

  it("renders navigation sidebar items", () => {
    render(<SettingsPageContent />);
    expect(screen.getByText("语言与地区")).toBeTruthy();
    expect(screen.getByText("通用")).toBeTruthy();
  });

  it("renders GeneralSection by default", () => {
    render(<SettingsPageContent />);
    expect(screen.getByText("GeneralSection")).toBeTruthy();
  });
});
