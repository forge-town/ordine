import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SaveButton } from "./SaveButton";

describe("SaveButton", () => {
  it("renders save text when not saved", () => {
    const handleSave = vi.fn();
    render(<SaveButton saved={false} onSave={handleSave} />);
    expect(screen.getByText("保存更改")).toBeTruthy();
  });

  it("renders saved text when saved", () => {
    const handleSave = vi.fn();
    render(<SaveButton saved={true} onSave={handleSave} />);
    expect(screen.getByText("已保存 ✓")).toBeTruthy();
  });
});
