import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AppearanceSection } from "./AppearanceSection";

describe("AppearanceSection", () => {
  it("renders theme title", () => {
    render(
      <AppearanceSection
        saved={false}
        values={{ theme: "light" }}
        onChange={vi.fn()}
        onSave={vi.fn()}
      />,
    );
    expect(screen.getByText("外观")).toBeTruthy();
  });

  it("renders theme options", () => {
    render(
      <AppearanceSection
        saved={false}
        values={{ theme: "light" }}
        onChange={vi.fn()}
        onSave={vi.fn()}
      />,
    );
    expect(screen.getByText("浅色")).toBeTruthy();
    expect(screen.getByText("深色")).toBeTruthy();
    expect(screen.getByText("跟随系统")).toBeTruthy();
  });
});
