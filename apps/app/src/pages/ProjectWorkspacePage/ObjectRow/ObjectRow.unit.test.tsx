import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ObjectRow } from "./ObjectRow";
import { createStore } from "zustand";

const mockToggleObject = vi.fn();

vi.mock("../_store", () => ({
  useProjectWorkspacePageStore: () =>
    createStore(() => ({
      selectedObjects: new Set(),
      selectedPipelineId: null,
      handleToggleObject: mockToggleObject,
      handleSelectPipeline: vi.fn(),
      handleClearSelectedObjects: vi.fn(),
    })),
}));

const mockItem = {
  type: "file" as const,
  path: "/src/main.ts",
  label: "src/main.ts",
};

describe("ObjectRow", () => {
  it("renders label", () => {
    render(<ObjectRow item={mockItem} selected={false} />);
    expect(screen.getByText("src/main.ts")).toBeInTheDocument();
  });

  it("calls store handleToggleObject when clicked", () => {
    render(<ObjectRow item={mockItem} selected={false} />);
    fireEvent.click(screen.getByRole("button"));
    expect(mockToggleObject).toHaveBeenCalledWith("/src/main.ts");
  });
});
