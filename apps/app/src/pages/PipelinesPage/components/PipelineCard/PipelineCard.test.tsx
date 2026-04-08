import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PipelineCard } from "./PipelineCard";
import type { StoredPipeline } from "@/models/daos/pipelinesDao";

const mockPipeline: StoredPipeline = {
  id: "pipe-001",
  name: "测试 Pipeline",
  description: "描述内容",
  tags: [],
  nodes: [],
  edges: [],
  createdAt: Date.now(),
  updatedAt: Date.now(),
} as unknown as StoredPipeline;

describe("PipelineCard", () => {
  it("renders pipeline name", () => {
    render(
      <PipelineCard
        pipeline={mockPipeline}
        onDelete={() => {}}
        onOpen={() => {}}
      />,
    );
    expect(screen.getByText("测试 Pipeline")).toBeInTheDocument();
  });
});
