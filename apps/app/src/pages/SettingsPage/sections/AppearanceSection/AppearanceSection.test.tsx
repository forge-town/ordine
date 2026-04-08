import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AppearanceSection } from "./AppearanceSection";

describe("AppearanceSection", () => {
  it("renders theme title", () => {
    const handleChange = vi.fn();
    const handleSave = vi.fn();
    render(
      <AppearanceSection
        saved={false}
        values={{ theme: "light" }}
        onChange={handleChange}
        onSave={handleSave}
      />
    );
    expect(screen.getByText("外观")).toBeTruthy();
  });

  it("renders theme options", () => {
    const handleChange = vi.fn();
    const handleSave = vi.fn();
    render(
      <AppearanceSection
        saved={false}
        values={{ theme: "light" }}
        onChange={handleChange}
        onSave={handleSave}
      />
    );
    expect(screen.getByText("浅色")).toBeTruthy();
    expect(screen.getByText("深色")).toBeTruthy();
    expect(screen.getByText("跟随系统")).toBeTruthy();
  });
});
