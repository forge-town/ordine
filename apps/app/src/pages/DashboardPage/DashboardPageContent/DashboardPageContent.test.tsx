import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DashboardPageContent } from "./DashboardPageContent";
import type { JobEntity } from "@/models/daos/jobsDao";

const mockJobs: JobEntity[] = [
  {
    id: "job-1",
    title: "运行 Pipeline",
    type: "pipeline_run",
    status: "done",
    workId: null,
    projectId: null,
    pipelineId: "p-1",
    logs: [],
    result: null,
    error: null,
    startedAt: null,
    finishedAt: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

const useLoaderData = vi.fn(() => ({
  pipelines: [],
  projects: [],
  jobs: [] as JobEntity[],
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
    useLoaderData.mockReturnValue({
      pipelines: [],
      projects: [],
      jobs: mockJobs,
    });
    render(<DashboardPageContent />);
    expect(screen.getByText("运行 Pipeline")).toBeInTheDocument();
  });
});
