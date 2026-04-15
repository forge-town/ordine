import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { JobDetailPageContent } from "./JobDetailPageContent";
import type { JobEntity } from "@repo/models";

const mockUseLoaderData = vi.fn();

vi.mock("@/routes/_layout/jobs.$jobId", () => ({
  Route: { useLoaderData: () => mockUseLoaderData() },
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
}));

const mockJob: JobEntity = {
  id: "job-1",
  title: "运行 Pipeline: 代码分析",
  type: "pipeline_run",
  status: "done",
  projectId: null,
  pipelineId: "p-1",
  logs: [],
  result: null,
  error: null,
  startedAt: null,
  finishedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("JobDetailPageContent", () => {
  it("renders job title", () => {
    mockUseLoaderData.mockReturnValue(mockJob);
    render(<JobDetailPageContent />);
    expect(screen.getByText(mockJob.title)).toBeInTheDocument();
  });

  it("renders null state when job is null", () => {
    mockUseLoaderData.mockReturnValue(null);
    render(<JobDetailPageContent />);
    expect(screen.getByText("不存在")).toBeInTheDocument();
  });
});
