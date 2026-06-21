import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { render } from "@/test/test-wrapper";
import type { PipelineAsset } from "@repo/schemas";
import { ComponentsPageContent } from "./ComponentsPageContent";

const mockAsset: PipelineAsset = {
  id: "asset-1",
  pipelineId: "pipe-1",
  name: "Textbook to Notion Quiz",
  description: "Reusable quiz pipeline",
  snapshotNodes: [],
  snapshotEdges: [],
  inputSlots: [],
  totalRuns: 3,
  successRate: 1,
  avgDurationMs: 1200,
  tags: [],
  createdAt: new Date("2026-06-10T10:00:00.000Z"),
  updatedAt: new Date("2026-06-10T10:00:00.000Z"),
};

vi.mock("@refinedev/core", () => ({
  useDelete: () => ({ mutate: vi.fn() }),
  useList: () => ({
    result: { data: [mockAsset] },
  }),
  useUpdate: () => ({ mutate: vi.fn() }),
}));

describe("ComponentsPageContent", () => {
  it("renders component sections and distilled pipeline assets", () => {
    render(<ComponentsPageContent />);

    expect(screen.getByRole("heading", { name: "Components" })).toBeInTheDocument();
    expect(screen.getAllByText("Input Objects").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Operations").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Output").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Pipeline Skill").length).toBeGreaterThan(0);
    expect(screen.getByText("Textbook to Notion Quiz")).toBeInTheDocument();
    expect(screen.getByText("used in 3 pipelines")).toBeInTheDocument();
  });
});
