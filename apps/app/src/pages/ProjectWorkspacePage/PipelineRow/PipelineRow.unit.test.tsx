import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { type PipelineData, PipelineSchema } from "@repo/pipeline-engine/schemas";
import { PipelineRow } from "./PipelineRow";

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
    const handleSelect = vi.fn();
    render(<PipelineRow pipeline={mockPipeline} selected={false} onSelect={handleSelect} />);
    expect(screen.getByText("CI Pipeline")).toBeInTheDocument();
  });

  it("renders description", () => {
    const handleSelect = vi.fn();
    render(<PipelineRow pipeline={mockPipeline} selected={false} onSelect={handleSelect} />);
    expect(screen.getByText("持续集成流水线")).toBeInTheDocument();
  });

  it("calls onSelect when clicked", () => {
    const handleSelect = vi.fn();
    render(<PipelineRow pipeline={mockPipeline} selected={false} onSelect={handleSelect} />);
    fireEvent.click(screen.getByRole("button"));
    expect(handleSelect).toHaveBeenCalledTimes(1);
  });
});
