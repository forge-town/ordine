import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { JobDetailPageContent } from "./JobDetailPageContent";
import type { JobEntity } from "@/models/daos/jobsDao";

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
}));

const mockJob: JobEntity = {
  id: "job-1",
  title: "运行 Pipeline: 代码分析",
  type: "pipeline_run",
  status: "done",
  workId: null,
  projectId: null,
  pipelineId: "p-1",
  logs: [],
  result: undefined,
  error: null,
  startedAt: null,
  finishedAt: null,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

describe("JobDetailPageContent", () => {
  it("renders job title", () => {
    render(<JobDetailPageContent job={mockJob} />);
    expect(screen.getByText(mockJob.title)).toBeInTheDocument();
  });

  it("renders null state when job is null", () => {
    render(<JobDetailPageContent job={null} />);
    expect(screen.getByText("Job 不存在")).toBeInTheDocument();
  });
});
