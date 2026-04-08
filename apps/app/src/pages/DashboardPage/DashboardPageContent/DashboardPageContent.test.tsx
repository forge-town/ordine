import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DashboardPageContent } from "./DashboardPageContent";
import type { PipelineEntity } from "@/models/daos/pipelinesDao";
import type { GithubProjectEntity } from "@/models/daos/githubProjectsDao";
import type { JobEntity } from "@/models/daos/jobsDao";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
  }: {
    children: React.ReactNode;
    to: string;
    params?: Record<string, string>;
    className?: string;
  }) => <a>{children}</a>,
}));

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
    result: undefined,
    error: null,
    startedAt: null,
    finishedAt: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

describe("DashboardPageContent", () => {
  it("renders page header", () => {
    render(
      <DashboardPageContent
        jobs={[]}
        pipelines={[] as PipelineEntity[]}
        projects={[] as GithubProjectEntity[]}
      />,
    );
    expect(screen.getByText("仪表盘")).toBeInTheDocument();
  });

  it("renders empty jobs state", () => {
    render(
      <DashboardPageContent
        jobs={[]}
        pipelines={[] as PipelineEntity[]}
        projects={[] as GithubProjectEntity[]}
      />,
    );
    expect(
      screen.getByText("触发 Pipeline 后会在此显示"),
    ).toBeInTheDocument();
  });

  it("renders job list when jobs exist", () => {
    render(
      <DashboardPageContent
        jobs={mockJobs}
        pipelines={[] as PipelineEntity[]}
        projects={[] as GithubProjectEntity[]}
      />,
    );
    expect(screen.getByText("运行 Pipeline")).toBeInTheDocument();
  });
});
