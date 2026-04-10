import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LanguageSection } from "./LanguageSection";
import { SettingsStoreProvider } from "../../_store";

const renderWithStore = (initial = {}) =>
  render(
    <SettingsStoreProvider initialSettings={initial}>
      <LanguageSection />
    </SettingsStoreProvider>,
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
