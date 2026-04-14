import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PipelineCard } from "./PipelineCard";
import type { StoredPipeline } from "@repo/models";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

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
    const handleDelete = vi.fn();
    const handleOpen = vi.fn();
    render(<PipelineCard pipeline={mockPipeline} onDelete={handleDelete} onOpen={handleOpen} />);
    expect(screen.getByText("测试 Pipeline")).toBeInTheDocument();
  });
});
