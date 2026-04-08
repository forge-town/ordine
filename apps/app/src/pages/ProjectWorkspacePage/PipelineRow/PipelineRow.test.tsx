import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PipelineRow } from "./PipelineRow";
import type { PipelineEntity } from "@/models/daos/pipelinesDao";

const mockPipeline = {
  id: "pipe-001",
  name: "CI Pipeline",
  description: "持续集成流水线",
} as unknown as PipelineEntity;

describe("PipelineRow", () => {
  it("renders pipeline name", () => {
    render(
      <PipelineRow
        pipeline={mockPipeline}
        selected={false}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("CI Pipeline")).toBeInTheDocument();
  });

  it("renders description", () => {
    render(
      <PipelineRow
        pipeline={mockPipeline}
        selected={false}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("持续集成流水线")).toBeInTheDocument();
  });

  it("calls onSelect when clicked", () => {
    const handleSelect = vi.fn();
    render(
      <PipelineRow
        pipeline={mockPipeline}
        selected={false}
        onSelect={handleSelect}
      />,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(handleSelect).toHaveBeenCalledTimes(1);
  });
});
