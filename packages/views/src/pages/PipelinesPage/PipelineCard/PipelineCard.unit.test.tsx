import { fireEvent, render, screen } from "@testing-library/react";
import type * as RefineCore from "@refinedev/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PipelineData } from "@repo/schemas";
import { PipelineCard } from "./PipelineCard";

const navigate = vi.fn();
const deletePipeline = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...props }: React.ComponentProps<"a">) => <a {...props}>{children}</a>,
  useNavigate: () => navigate,
}));

vi.mock("@refinedev/core", async (importOriginal) => ({
  ...(await importOriginal<typeof RefineCore>()),
  useDelete: () => ({ mutate: deletePipeline }),
}));

const pipeline: PipelineData = {
  id: "pipeline-1",
  name: "Release pipeline",
  description: "Build and publish",
  sharedContext: "",
  tags: [],
  timeoutMs: null,
  projectId: "project-1",
  status: "draft",
  version: 1,
  createdAt: new Date("2026-08-04T00:00:00Z"),
  updatedAt: new Date("2026-08-04T00:00:00Z"),
  nodes: [],
  edges: [],
};

describe("PipelineCard", () => {
  beforeEach(() => {
    navigate.mockReset();
    deletePipeline.mockReset();
  });

  it("renders metadata and aggregated stats", () => {
    render(
      <PipelineCard
        metrics={{
          totalRuns: 8,
          successRate: 0.75,
          avgDurationMs: 12_000,
          isSavedSkill: true,
          isScheduled: true,
        }}
        pipeline={pipeline}
      />,
    );

    expect(screen.getByText("8")).toBeInTheDocument();
    expect(screen.getByText("75%")).toBeInTheDocument();
    expect(screen.getByText("12s")).toBeInTheDocument();
    expect(screen.getByText("已保存技能")).toBeInTheDocument();
    expect(screen.getByText("已调度")).toBeInTheDocument();
    expect(screen.getByText("草稿")).toBeInTheDocument();
  });

  it("uses the shared interactive surface", () => {
    render(
      <PipelineCard
        metrics={{
          totalRuns: 0,
          successRate: null,
          avgDurationMs: null,
          isSavedSkill: false,
          isScheduled: false,
        }}
        pipeline={pipeline}
      />,
    );

    const card = screen.getByText("Release pipeline").closest('[data-slot="card"]');
    expect(card).toHaveAttribute("data-variant", "surface");
    expect(card).toHaveClass("rounded-lg", "shadow-soft", "ring-border", "p-4");
    expect(card).toHaveClass("hover:shadow-float", "hover:ring-border-strong");
  });

  it("opens Canvas and keeps delete as a separate action", () => {
    render(
      <PipelineCard
        metrics={{
          totalRuns: 0,
          successRate: null,
          avgDurationMs: null,
          isSavedSkill: false,
          isScheduled: false,
        }}
        pipeline={pipeline}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "在 Canvas 中打开 Release pipeline" }));
    expect(navigate).toHaveBeenCalledWith({ to: "/canvas", search: { id: "pipeline-1" } });

    fireEvent.click(screen.getByRole("button", { name: "删除 Release pipeline" }));
    expect(deletePipeline).toHaveBeenCalledWith({ resource: "pipelines", id: "pipeline-1" });
    expect(navigate).toHaveBeenCalledTimes(1);
  });
});
