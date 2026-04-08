import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SaveButton } from "./SaveButton";

describe("SaveButton", () => {
  it("renders save text when not saved", () => {
    render(<SaveButton saved={false} onSave={vi.fn()} />);
    expect(screen.getByText("保存更改")).toBeTruthy();
  });

  it("renders saved text when saved", () => {
    render(<SaveButton saved={true} onSave={vi.fn()} />);
    expect(screen.getByText("已保存 ✓")).toBeTruthy();
  });
});
