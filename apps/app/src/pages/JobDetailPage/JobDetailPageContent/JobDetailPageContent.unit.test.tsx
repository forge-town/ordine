import { render } from "@/test/test-wrapper";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { JobDetailPageContent } from "./JobDetailPageContent";
import type { JobRecord } from "@repo/db-schema";

const mockUseLoaderData = vi.fn();
const { mockGetTracesQuery, mockGetAgentRunsQuery, mockGetAgentRunSpansQuery } = vi.hoisted(() => ({
  mockGetTracesQuery: vi.fn().mockResolvedValue([]),
  mockGetAgentRunsQuery: vi.fn().mockResolvedValue([]),
  mockGetAgentRunSpansQuery: vi.fn().mockResolvedValue([]),
}));
const mockWriteText = vi.fn().mockResolvedValue(undefined);

vi.mock("@/routes/_layout/jobs.$jobId", () => ({
  Route: { useParams: () => ({ jobId: "job-1" }), useLoaderData: () => mockUseLoaderData() },
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("@/integrations/trpc/client", () => ({
  trpcClient: {
    jobs: {
      getTraces: { query: mockGetTracesQuery },
      getAgentRuns: { query: mockGetAgentRunsQuery },
      getAgentRunSpans: { query: mockGetAgentRunSpansQuery },
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
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: mockWriteText },
      configurable: true,
    });
  });

  it("renders job title", async () => {
    mockUseLoaderData.mockReturnValue(mockJob);
    render(<JobDetailPageContent />);

    await waitFor(() => {
      expect(mockGetTracesQuery).toHaveBeenCalledTimes(1);
      expect(mockGetAgentRunsQuery).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText(mockJob.title)).toBeInTheDocument();
  });

  it("renders a single agent runs panel and fetches agent runs once", async () => {
    mockUseLoaderData.mockReturnValue(mockJob);

    render(<JobDetailPageContent />);

    await waitFor(() => {
      expect(mockGetAgentRunsQuery).toHaveBeenCalledTimes(1);
    });

    expect(screen.getAllByText("Agent Runs")).toHaveLength(1);
  });

  it("renders null state when job is null", async () => {
    mockUseLoaderData.mockReturnValue(null);
    render(<JobDetailPageContent />);

    await waitFor(() => {
      expect(mockGetTracesQuery).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText("不存在")).toBeInTheDocument();
  });
});
