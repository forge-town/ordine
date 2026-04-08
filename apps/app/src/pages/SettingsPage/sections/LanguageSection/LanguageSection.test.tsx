import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LanguageSection } from "./LanguageSection";

describe("LanguageSection", () => {
  it("renders section title", () => {
    render(
      <LanguageSection
        saved={false}
        values={{ language: "zh-CN", timezone: "Asia/Shanghai" }}
        onChange={vi.fn()}
        onSave={vi.fn()}
      />,
    );
    expect(screen.getByText("语言与地区")).toBeTruthy();
  });

  it("renders language field", () => {
    render(
      <LanguageSection
        saved={false}
        values={{ language: "zh-CN", timezone: "Asia/Shanghai" }}
        onChange={vi.fn()}
        onSave={vi.fn()}
      />,
    );
    expect(screen.getByText("界面语言")).toBeTruthy();
  });
});
