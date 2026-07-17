import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SettingsPageStoreProvider } from "../../_store";
import { LanguageSection } from "./LanguageSection";

const renderWithStore = (initial = {}) =>
  render(
    <SettingsPageStoreProvider initialSettings={initial}>
      <LanguageSection />
    </SettingsPageStoreProvider>,
  );

describe("LanguageSection", () => {
  it("renders section title", () => {
    renderWithStore({
      language: { language: "zh-CN", timezone: "Asia/Shanghai" },
    });
    expect(screen.getAllByText("语言").length).toBeGreaterThan(0);
  });

  it("renders language field", () => {
    renderWithStore({
      language: { language: "zh-CN", timezone: "Asia/Shanghai" },
    });
    expect(screen.getAllByText("语言").length).toBeGreaterThan(0);
  });
});
