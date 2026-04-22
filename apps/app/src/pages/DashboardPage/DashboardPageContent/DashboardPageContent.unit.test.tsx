import { render } from "@/test/test-wrapper";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DashboardPageContent } from "./DashboardPageContent";
import type { Job } from "@repo/schemas";

const mockJobs: Job[] = [
  {
    id: "job-1",
    title: "运行 Pipeline",
    type: "pipeline_run",
    status: "done",
    projectId: null,
    pipelineId: "p-1",
    logs: [],
    result: null,
    error: null,
    startedAt: null,
    finishedAt: null,
    tmuxSessionName: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const useLoaderData = vi.fn(() => ({
  pipelines: [],
  projects: [],
  jobs: [] as Job[],
}));

vi.mock("@/routes/_layout/index", () => ({
  Route: {
    get useLoaderData() {
      return useLoaderData;
    },
  },
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (opts: Record<string, unknown>) => opts,
  Link: ({
    children,
  }: {
    children: React.ReactNode;
    to: string;
    params?: Record<string, string>;
    className?: string;
  }) => <a>{children}</a>,
}));

const jobsData = vi.fn(() => [] as Job[]);

vi.mock("@refinedev/core", () => ({
  useList: (opts: { resource: string }) => {
    const d = opts.resource === "jobs" ? jobsData() : [];

    return {
      result: { data: d, total: d.length },
      data: { data: d, total: d.length },
      isLoading: false,
      isError: false,
    };
  },
  useDelete: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }),
  useCreate: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }),
  useUpdate: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }),
  useCustomMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }),
  useInvalidate: () => vi.fn(),
  useOne: () => ({ result: null, isLoading: false }),
}));

describe("DashboardPageContent", () => {
  it("renders page header", () => {
    render(<DashboardPageContent />);
    expect(screen.getByText("仪表盘")).toBeInTheDocument();
  });

  it("renders empty jobs state", () => {
    render(<DashboardPageContent />);
    expect(screen.getByText("触发 Pipeline 后会在此显示")).toBeInTheDocument();
  });

  it("renders job list when jobs exist", () => {
    jobsData.mockReturnValue(mockJobs);
    render(<DashboardPageContent />);
    expect(screen.getByText("运行 Pipeline")).toBeInTheDocument();
  });
});
