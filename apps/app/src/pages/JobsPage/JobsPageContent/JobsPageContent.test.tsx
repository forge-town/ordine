import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { JobsPageContent } from "./JobsPageContent";
import type { JobEntity } from "@/models/daos/jobsDao";

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("@/services/jobsService", () => ({
  deleteJob: vi.fn().mockResolvedValue(undefined),
}));

const mockJobs: JobEntity[] = [
  {
    id: "job-001",
    title: "Pipeline 运行",
    status: "running",
    type: "pipeline_run",
    projectId: "proj-001",
    pipelineId: null,
    workId: null,
    logs: [],
    result: null,
    error: null,
    startedAt: Date.now() - 3000,
    finishedAt: null,
    createdAt: Date.now() - 5000,
    updatedAt: Date.now(),
  },
  {
    id: "job-002",
    title: "代码分析",
    status: "done",
    type: "code_analysis",
    projectId: "proj-002",
    pipelineId: null,
    workId: null,
    logs: [],
    result: null,
    error: null,
    startedAt: Date.now() - 10_000,
    finishedAt: Date.now() - 2000,
    createdAt: Date.now() - 12_000,
    updatedAt: Date.now(),
  },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("JobsPageContent", () => {
  it("renders jobs header", () => {
    render(<JobsPageContent jobs={mockJobs} />);
    expect(screen.getByText("Jobs 监控")).toBeInTheDocument();
  });

  it("renders job rows", () => {
    render(<JobsPageContent jobs={mockJobs} />);
    expect(screen.getByText("Pipeline 运行")).toBeInTheDocument();
    expect(screen.getAllByText("代码分析").length).toBeGreaterThan(0);
  });

  it("renders empty state when no jobs", () => {
    render(<JobsPageContent jobs={[]} />);
    expect(screen.getByText("暂无 Job")).toBeInTheDocument();
  });

  it("shows running count badge", () => {
    render(<JobsPageContent jobs={mockJobs} />);
    expect(screen.getByText("1 运行中")).toBeInTheDocument();
  });
});
