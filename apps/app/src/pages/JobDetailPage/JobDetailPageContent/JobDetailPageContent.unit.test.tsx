import { render } from "@/test/test-wrapper";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { JobDetailPageContent } from "./JobDetailPageContent";
import type { JobRecord } from "@repo/db-schema";

const mockUseLoaderData = vi.fn();

vi.mock("@/routes/_layout/jobs.$jobId", () => ({
  Route: { useParams: () => ({ jobId: "job-1" }), useLoaderData: () => mockUseLoaderData() },
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("@/integrations/trpc/client", () => ({
  trpcClient: {
    jobs: {
      getTraces: { query: vi.fn().mockResolvedValue([]) },
      getAgentRuns: { query: vi.fn().mockResolvedValue([]) },
      getAgentRunSpans: { query: vi.fn().mockResolvedValue([]) },
    },
  },
}));

vi.mock("@refinedev/core", () => ({
  useList: () => ({
    result: { data: [], total: 0 },
    data: { data: [], total: 0 },
    isLoading: false,
    isError: false,
  }),
  useDelete: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }),
  useCreate: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }),
  useUpdate: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }),
  useCustomMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }),
  useInvalidate: () => vi.fn(),
  useOne: () => ({ result: mockUseLoaderData(), isLoading: false }),
}));

const mockJob: JobRecord = {
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
  tmuxSessionName: null,
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
