import { render } from "@/test/test-wrapper";
import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RunConsole } from "./RunConsole";
import { HarnessCanvasStoreProvider, useHarnessCanvasStore } from "../_store";
import { useStore } from "zustand";
import { useEffect } from "react";

vi.mock("@xyflow/react", () => ({
  Handle: () => null,
  Position: { Top: "top", Bottom: "bottom", Left: "left", Right: "right" },
  ReactFlowProvider: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

const { mockGetTracesQuery } = vi.hoisted(() => ({
  mockGetTracesQuery: vi
    .fn()
    .mockResolvedValue([
      { message: "[2026-04-08T16:00:00.000Z] Starting pipeline abc" },
      { message: "[2026-04-08T16:00:01.000Z] Processing node [github-project] skills" },
    ]),
}));

vi.mock("@/integrations/trpc/client", () => ({
  trpcClient: {
    jobs: {
      getTraces: { query: mockGetTracesQuery },
    },
  },
}));

const SetActiveJob = ({
  jobId,
  children,
}: {
  jobId: string | null;
  children?: React.ReactNode;
}) => {
  const store = useHarnessCanvasStore();
  const setActiveJobId = useStore(store, (s) => s.setActiveJobId);
  useEffect(() => {
    setActiveJobId(jobId);
  }, [jobId, setActiveJobId]);

  return <>{children}</>;
};

const wrapper = ({ children }: { children?: React.ReactNode }) => (
  <HarnessCanvasStoreProvider>{children}</HarnessCanvasStoreProvider>
);

const wrapperWithJob = (jobId: string | null) => {
  const Wrapper = ({ children }: { children?: React.ReactNode }) => (
    <HarnessCanvasStoreProvider>
      <SetActiveJob jobId={jobId}>{children}</SetActiveJob>
    </HarnessCanvasStoreProvider>
  );

  return Wrapper;
};

const mockJobRunning = {
  id: "job-1",
  title: "Pipeline run",
  type: "pipeline_run",
  status: "running" as string,
  error: null,
  meta: { createdAt: new Date(), updatedAt: new Date() },
  startedAt: Date.now(),
  finishedAt: null as number | null,
  parentJobId: null,
};

const mockJobDone = {
  ...mockJobRunning,
  status: "done" as const,
  finishedAt: Date.now(),
};

const useOneData = vi.fn(() => mockJobRunning);

vi.mock("@refinedev/core", () => ({
  useDataProvider: () => () => ({
    getOne: vi.fn(async () => ({ data: useOneData() })),
    custom: vi.fn(async () => ({
      data: {
        traces: [
          { message: "[2026-04-08T16:00:00.000Z] Starting pipeline abc" },
          { message: "[2026-04-08T16:00:01.000Z] Processing node [github-project] skills" },
        ],
      },
    })),
  }),
  useOne: () => ({
    query: {
      data: { data: useOneData() },
      isLoading: false,
    },
  }),
  useCustom: () => ({
    result: {
      data: {
        traces: [
          { message: "[2026-04-08T16:00:00.000Z] Starting pipeline abc" },
          { message: "[2026-04-08T16:00:01.000Z] Processing node [github-project] skills" },
        ],
      },
    },
    isLoading: false,
  }),
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
}));

describe("RunConsole", () => {
  it("renders nothing when jobId is null", () => {
    const { container } = render(<RunConsole />, { wrapper });
    expect(container.firstChild).toBeNull();
  });

  it("shows status bar with running indicator", () => {
    render(<RunConsole />, { wrapper: wrapperWithJob("job-1") });
    expect(screen.getByText(/Running/i)).toBeInTheDocument();
  });

  it("displays log entries from traces", async () => {
    render(<RunConsole />, { wrapper: wrapperWithJob("job-1") });
    await waitFor(() => {
      expect(screen.getByText(/Starting pipeline/)).toBeInTheDocument();
    });
    expect(screen.getByText(/Processing node/)).toBeInTheDocument();
  });

  it("shows done status when job completes", () => {
    useOneData.mockReturnValue(mockJobDone);
    render(<RunConsole />, { wrapper: wrapperWithJob("job-1") });
    expect(screen.getByText(/Done/i)).toBeInTheDocument();
    useOneData.mockReturnValue(mockJobRunning);
  });

  it("polls for updates while running", () => {
    render(<RunConsole />, { wrapper: wrapperWithJob("job-1") });
    expect(screen.getByText(/Running/i)).toBeInTheDocument();
  });

  it("stops polling when job is done", () => {
    useOneData.mockReturnValue(mockJobDone);
    render(<RunConsole />, { wrapper: wrapperWithJob("job-1") });
    expect(screen.getByText(/Done/i)).toBeInTheDocument();
    useOneData.mockReturnValue(mockJobRunning);
  });
});
