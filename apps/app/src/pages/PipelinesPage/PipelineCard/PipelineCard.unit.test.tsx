import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { type PipelineData, PipelineSchema } from "@repo/schemas";
import { PipelineCard } from "./PipelineCard";

const mockPipelineInput = PipelineSchema.parse({
  id: "pipe-001",
  name: "测试 Pipeline",
  description: "描述内容",
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

describe("PipelineCard", () => {
  it("renders pipeline metadata", () => {
    const handleOpen = vi.fn();

    render(
      <PipelineCard
        isSavedSkill
        isScheduled
        pipeline={mockPipeline}
        routineLabel="Daily"
        stats={{ avgDurationMs: 5000, runs: 2, successRate: 100 }}
        onOpen={handleOpen}
      />,
    );

    expect(screen.getByText("测试 Pipeline")).toBeInTheDocument();
    expect(screen.getByText("Saved Skill")).toBeInTheDocument();
    expect(screen.getByText("Routine")).toBeInTheDocument();
    expect(screen.getByText("2 runs")).toBeInTheDocument();
  });
});
