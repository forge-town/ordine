import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ObjectRow } from "./ObjectRow";

const mockItem = {
  type: "file" as const,
  path: "/src/main.ts",
  label: "src/main.ts",
};

describe("ObjectRow", () => {
  it("renders label", () => {
    render(<ObjectRow item={mockItem} selected={false} onToggle={vi.fn()} />);
    expect(screen.getByText("src/main.ts")).toBeInTheDocument();
  });

  it("calls onToggle when clicked", () => {
    const handleToggle = vi.fn();
    render(
      <ObjectRow item={mockItem} selected={false} onToggle={handleToggle} />,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(handleToggle).toHaveBeenCalledTimes(1);
  });
});
