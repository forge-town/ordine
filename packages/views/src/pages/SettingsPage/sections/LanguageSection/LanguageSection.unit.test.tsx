import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeStoreProvider } from "../../../../store/themeStore";
import { SettingsPageStoreProvider } from "../../_store";
import { LanguageSection } from "./LanguageSection";

const renderWithStore = (initial = {}) =>
  render(
    <ThemeStoreProvider>
      <SettingsPageStoreProvider initialSettings={initial}>
        <LanguageSection />
      </SettingsPageStoreProvider>
    </ThemeStoreProvider>,
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
