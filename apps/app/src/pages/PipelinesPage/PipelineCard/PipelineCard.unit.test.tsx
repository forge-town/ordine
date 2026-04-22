import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { PipelineData } from "@repo/pipeline-engine/schemas";
import { PipelineSchema } from "@repo/pipeline-engine/schemas";
import { PipelineCard } from "./PipelineCard";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

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
  it("renders pipeline name", () => {
    const handleDelete = vi.fn();
    const handleOpen = vi.fn();
    render(<PipelineCard pipeline={mockPipeline} onDelete={handleDelete} onOpen={handleOpen} />);
    expect(screen.getByText("测试 Pipeline")).toBeInTheDocument();
  });
});
