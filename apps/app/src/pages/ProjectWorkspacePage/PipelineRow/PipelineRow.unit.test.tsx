import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { type PipelineData, PipelineSchema } from "@repo/pipeline-engine/schemas";
import { PipelineRow } from "./PipelineRow";
import { createStore } from "zustand";

const mockSelectPipeline = vi.fn();

vi.mock("../_store", () => ({
  useProjectWorkspacePageStore: () =>
    createStore(() => ({
      selectedObjects: new Set(),
      selectedPipelineId: null,
      handleToggleObject: vi.fn(),
      handleSelectPipeline: mockSelectPipeline,
      handleClearSelectedObjects: vi.fn(),
    })),
}));

const mockPipelineInput = PipelineSchema.parse({
  id: "pipe-001",
  name: "CI Pipeline",
  description: "持续集成流水线",
  tags: [],
  timeoutMs: null,
  nodes: [],
  edges: [],
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

const mockPipeline: PipelineData = {
  ...mockPipelineInput,
  createdAt: new Date(mockPipelineInput.createdAt),
  updatedAt: new Date(mockPipelineInput.updatedAt),
};

describe("PipelineRow", () => {
  it("renders pipeline name", () => {
    render(<PipelineRow pipeline={mockPipeline} selected={false} />);
    expect(screen.getByText("CI Pipeline")).toBeInTheDocument();
  });

  it("renders description", () => {
    render(<PipelineRow pipeline={mockPipeline} selected={false} />);
    expect(screen.getByText("持续集成流水线")).toBeInTheDocument();
  });

  it("calls store handleSelectPipeline when clicked", () => {
    render(<PipelineRow pipeline={mockPipeline} selected={false} />);
    fireEvent.click(screen.getByRole("button"));
    expect(mockSelectPipeline).toHaveBeenCalledWith("pipe-001");
  });
});
