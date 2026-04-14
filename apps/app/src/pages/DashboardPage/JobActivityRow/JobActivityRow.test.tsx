import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { JobActivityRow } from "./JobActivityRow";
import type { JobEntity } from "@repo/models";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
  }: {
    children: React.ReactNode;
    to: string;
    params?: Record<string, string>;
  }) => <a>{children}</a>,
}));

const mockJob: JobEntity = {
  id: "job-1",
  title: "运行 Pipeline: 代码分析",
  type: "pipeline_run",
  status: "done",
  workId: null,
  projectId: null,
  pipelineId: "pipeline-1",
  logs: [],
  result: null,
  error: null,
  startedAt: null,
  finishedAt: null,
  createdAt: Date.now(),
  updatedAt: Date.now(),
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
