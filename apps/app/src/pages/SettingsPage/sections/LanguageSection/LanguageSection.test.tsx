import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LanguageSection } from "./LanguageSection";

describe("LanguageSection", () => {
  it("renders section title", () => {
    const handleChange = vi.fn();
    const handleSave = vi.fn();
    render(
      <LanguageSection
        saved={false}
        values={{ language: "zh-CN", timezone: "Asia/Shanghai" }}
        onChange={handleChange}
        onSave={handleSave}
      />
    );
    expect(screen.getByText("语言与地区")).toBeTruthy();
  });

  it("renders language field", () => {
    const handleChange = vi.fn();
    const handleSave = vi.fn();
    render(
      <LanguageSection
        saved={false}
        values={{ language: "zh-CN", timezone: "Asia/Shanghai" }}
        onChange={handleChange}
        onSave={handleSave}
      />
    );
    expect(screen.getByText("界面语言")).toBeTruthy();
  });
});
