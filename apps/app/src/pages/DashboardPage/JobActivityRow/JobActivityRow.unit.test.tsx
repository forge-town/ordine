import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { JobActivityRow } from "./JobActivityRow";
import type { Job } from "@repo/schemas";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
  }: {
    children: React.ReactNode;
    to: string;
    params?: Record<string, string>;
  }) => <a>{children}</a>,
}));

const mockJob: Job = {
  id: "job-1",
  title: "运行 Pipeline: 代码分析",
  type: "pipeline_run",
  status: "done",
  projectId: null,
  pipelineId: "pipeline-1",
  logs: [],
  result: null,
  error: null,
  startedAt: null,
  finishedAt: null,
  tmuxSessionName: null,
  meta: { createdAt: new Date(), updatedAt: new Date() },
};

describe("JobActivityRow", () => {
  it("renders job title", () => {
    render(<JobActivityRow job={mockJob} />);
    expect(screen.getByText(mockJob.title)).toBeInTheDocument();
  });

  it("renders job status badge", () => {
    render(<JobActivityRow job={mockJob} />);
    expect(screen.getByText("done")).toBeInTheDocument();
  });
});
