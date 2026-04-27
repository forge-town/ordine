import { render } from "@/test/test-wrapper";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { JobDetailPageContent } from "./JobDetailPageContent";
import type { Job } from "@repo/schemas";

const mockUseLoaderData = vi.fn();
const {
  mockCreateDistillationMutate,
  mockGetAgentRunsQuery,
  mockGetAgentRunSpansQuery,
  mockGetTracesQuery,
  mockNavigate,
  mockRunDistillationMutate,
} = vi.hoisted(() => ({
  mockCreateDistillationMutate: vi.fn(),
  mockGetTracesQuery: vi.fn().mockResolvedValue([]),
  mockGetAgentRunsQuery: vi.fn().mockResolvedValue([]),
  mockGetAgentRunSpansQuery: vi.fn().mockResolvedValue([]),
  mockNavigate: vi.fn(),
  mockRunDistillationMutate: vi.fn(),
}));
const mockWriteText = vi.fn().mockResolvedValue(undefined);
const mockDistillationId = "00000000-0000-4000-8000-000000000001";

vi.mock("@/routes/_layout/jobs.$jobId", () => ({
  Route: { useParams: () => ({ jobId: "job-1" }), useLoaderData: () => mockUseLoaderData() },
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
  useNavigate: () => mockNavigate,
}));

vi.mock("@/integrations/trpc/client", () => ({
  trpcClient: {
    distillations: {
      create: { mutate: mockCreateDistillationMutate },
      run: { mutate: mockRunDistillationMutate },
    },
    jobs: {
      getTraces: { query: mockGetTracesQuery },
      getAgentRuns: { query: mockGetAgentRunsQuery },
      getAgentRunSpans: { query: mockGetAgentRunSpansQuery },
    },
  },
}));

const mockCreateMutateAsync = vi.fn();
const mockCustomMutationMutateAsync = vi.fn();

vi.mock("@refinedev/core", () => ({
  useList: () => ({
    result: { data: [], total: 0 },
    data: { data: [], total: 0 },
    isLoading: false,
    isError: false,
  }),
  useDelete: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }),
  useCreate: () => ({ mutate: vi.fn(), mutateAsync: mockCreateMutateAsync }),
  useUpdate: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }),
  useCustom: () => ({
    result: { data: { traces: [], agentRuns: [], spans: [] } },
    query: { isLoading: false },
    isLoading: false,
  }),
  useCustomMutation: () => ({ mutate: vi.fn(), mutateAsync: mockCustomMutationMutateAsync }),
  useInvalidate: () => vi.fn(),
  useOne: () => ({ result: mockUseLoaderData(), isLoading: false }),
}));

const mockJob: Job = {
  id: "job-1",
  title: "运行 Pipeline: 代码分析",
  type: "pipeline_run",
  status: "done",
  parentJobId: null,
  error: null,
  startedAt: null,
  finishedAt: null,
  meta: { createdAt: new Date(), updatedAt: new Date() },
};

describe("JobDetailPageContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateMutateAsync.mockResolvedValue({
      data: { id: mockDistillationId },
    });
    mockCustomMutationMutateAsync.mockResolvedValue({
      data: { id: mockDistillationId },
    });
    vi.spyOn(crypto, "randomUUID").mockReturnValue(mockDistillationId);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: mockWriteText },
      configurable: true,
    });
  });

  it("renders job title", () => {
    mockUseLoaderData.mockReturnValue(mockJob);
    render(<JobDetailPageContent />);

    expect(screen.getByText(mockJob.title)).toBeInTheDocument();
  });

  it("creates and runs a job distillation from the header action", async () => {
    mockUseLoaderData.mockReturnValue(mockJob);

    render(<JobDetailPageContent />);

    await userEvent.click(screen.getByRole("button", { name: "蒸馏 Job" }));

    await waitFor(() => {
      expect(mockCreateMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          resource: "distillations",
          values: expect.objectContaining({
            id: mockDistillationId,
            sourceType: "job",
            sourceId: mockJob.id,
            mode: "pipeline",
          }),
        })
      );
      expect(mockCustomMutationMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          url: "distillations/run",
          method: "post",
          values: { id: mockDistillationId },
        })
      );
      expect(mockNavigate).toHaveBeenCalledWith({
        to: "/distillations/$distillationId",
        params: { distillationId: mockDistillationId },
      });
    });
  });

  it("renders a single agent runs panel and fetches agent runs once", () => {
    mockUseLoaderData.mockReturnValue(mockJob);

    render(<JobDetailPageContent />);

    expect(screen.getAllByText("Agent Runs")).toHaveLength(1);
  });

  it("renders null state when job is null", () => {
    mockUseLoaderData.mockReturnValue(null);
    render(<JobDetailPageContent />);

    expect(screen.getByText("不存在")).toBeInTheDocument();
  });
});
