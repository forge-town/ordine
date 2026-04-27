import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@/test/test-wrapper";
import { screen } from "@testing-library/react";
import { JobsPageContent } from "./JobsPageContent";
import type { Job } from "@repo/schemas";

const mockUseLoaderData = vi.fn(() => [] as Job[]);

vi.mock("@/routes/_layout/jobs.index", () => ({
  Route: { useLoaderData: () => mockUseLoaderData() },
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
  useNavigate: () => vi.fn(),
}));

vi.mock("@/services/jobsService", () => ({
  deleteJob: vi.fn().mockResolvedValue(undefined),
}));

import { createStore } from "zustand";
vi.mock("../_store", () => ({
  useJobsPageStore: () =>
    createStore(() => ({
      search: "",
      statusFilter: "all",
      handleSetSearch: vi.fn(),
      handleSetStatusFilter: vi.fn(),
    })),
}));

vi.mock("@refinedev/core", () => ({
  useList: () => ({
    result: { data: mockUseLoaderData(), total: mockUseLoaderData().length },
    data: { data: mockUseLoaderData(), total: mockUseLoaderData().length },
    isLoading: false,
    isError: false,
  }),
  useDelete: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }),
  useCreate: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }),
  useUpdate: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }),
  useCustomMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }),
  useInvalidate: () => vi.fn(),
  useOne: () => ({ result: null, isLoading: false }),
}));

const mockJobs: Job[] = [
  {
    id: "job-001",
    title: "Pipeline 运行",
    status: "running",
    type: "pipeline_run",
    projectId: "proj-001",
    pipelineId: null,
    logs: [],
    result: null,
    error: null,
    startedAt: new Date(Date.now() - 3000),
    finishedAt: null,
    tmuxSessionName: null,
    meta: { createdAt: new Date(Date.now() - 5000), updatedAt: new Date() },
  },
  {
    id: "job-002",
    title: "代码分析",
    status: "done",
    type: "code_analysis",
    projectId: "proj-002",
    pipelineId: null,
    logs: [],
    result: null,
    error: null,
    startedAt: new Date(Date.now() - 10_000),
    finishedAt: new Date(Date.now() - 2000),
    tmuxSessionName: null,
    meta: { createdAt: new Date(Date.now() - 12_000), updatedAt: new Date() },
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockUseLoaderData.mockReturnValue(mockJobs);
});

describe("JobsPageContent", () => {
  it("renders jobs header", () => {
    render(<JobsPageContent />);
    expect(screen.getByText("Jobs 监控")).toBeInTheDocument();
  });

  it("renders job rows", () => {
    render(<JobsPageContent />);
    expect(screen.getByText("Pipeline 运行")).toBeInTheDocument();
    expect(screen.getAllByText("代码分析").length).toBeGreaterThan(0);
  });

  it("renders empty state when no jobs", () => {
    mockUseLoaderData.mockReturnValue([]);
    render(<JobsPageContent />);
    expect(screen.getByText("当前没有 Job")).toBeInTheDocument();
  });

  it("shows running count badge", () => {
    render(<JobsPageContent />);
    expect(screen.getByText("1 运行中")).toBeInTheDocument();
  });
});
