import { render } from "../../../test/test-wrapper";
import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RunConsole } from "./RunConsole";
import { CanvasPageStoreProvider, useCanvasPageStore } from "../_store";
import { useRef } from "react";

vi.mock("@xyflow/react", () => ({
  Handle: () => null,
  Position: { Top: "top", Bottom: "bottom", Left: "left", Right: "right" },
  ReactFlowProvider: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

const wrapper = ({ children }: { children?: React.ReactNode }) => (
  <CanvasPageStoreProvider>{children}</CanvasPageStoreProvider>
);

const JobActivator = ({
  jobId,
  children,
}: {
  jobId: string | null;
  children?: React.ReactNode;
}) => {
  const store = useCanvasPageStore();
  const initializedRef = useRef(false);
  if (!initializedRef.current) {
    initializedRef.current = true;
    store.setState({ activeJobId: jobId, isConsoleOpen: jobId !== null });
  }

  return <>{children}</>;
};

const wrapperWithJob = (jobId: string | null) => {
  const Wrapper = ({ children }: { children?: React.ReactNode }) => (
    <CanvasPageStoreProvider>
      <JobActivator jobId={jobId}>{children}</JobActivator>
    </CanvasPageStoreProvider>
  );

  return Wrapper;
};

const timelineWrapper = ({ children }: { children?: React.ReactNode }) => (
  <CanvasPageStoreProvider
    pipeline={{
      id: "pipe-1",
      name: "Pipeline",
      nodes: [
        { id: "file-a", type: "file", position: { x: 0, y: 0 }, data: { label: "File A" } },
        { id: "file-b", type: "file", position: { x: 0, y: 0 }, data: { label: "File B" } },
        {
          id: "merge-op",
          type: "operation",
          position: { x: 0, y: 0 },
          data: { label: "Merge Review" },
        },
      ],
      edges: [
        { id: "edge-a", source: "file-a", target: "merge-op" },
        { id: "edge-b", source: "file-b", target: "merge-op" },
      ],
    }}
  >
    <JobActivator jobId="job-1">{children}</JobActivator>
  </CanvasPageStoreProvider>
);

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

type MockTrace = {
  createdAt?: string;
  message: string;
};

const useOneData = vi.fn(() => mockJobRunning);
const useTraceData = vi.fn<() => MockTrace[]>(() => [
  { message: "[2026-04-08T16:00:00.000Z] Starting pipeline abc" },
  { message: "[2026-04-08T16:00:01.000Z] Processing node [github-project] skills" },
]);

beforeEach(() => {
  useOneData.mockReturnValue(mockJobRunning);
  useTraceData.mockReturnValue([
    { message: "[2026-04-08T16:00:00.000Z] Starting pipeline abc" },
    { message: "[2026-04-08T16:00:01.000Z] Processing node [github-project] skills" },
  ]);
});

vi.mock("@refinedev/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@refinedev/core")>()),
  useDataProvider: () => () => ({
    getOne: vi.fn(async () => ({ data: useOneData() })),
    custom: vi.fn(async () => ({
      data: {
        traces: useTraceData(),
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
        traces: useTraceData(),
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
  it("renders console shell when jobId is null", () => {
    const { container } = render(<RunConsole />, { wrapper });
    expect(container.firstChild).not.toBeNull();
    expect(screen.getByText("Console")).toBeInTheDocument();
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
    expect(screen.getAllByText(/Processing node/).length).toBeGreaterThan(0);
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

  it("shows run timeline, current step, artifacts, and multi-input semantics", () => {
    useTraceData.mockReturnValue([
      {
        createdAt: "2026-04-08T16:00:03.000Z",
        message: '[2026-04-08T16:00:03.000Z] Executing operation "Merge review" (agent)',
      },
      {
        createdAt: "2026-04-08T16:00:04.000Z",
        message:
          "[2026-04-08T16:00:04.000Z] Wrote output to: C:\\tmp\\ordine-output\\review-report.md (120 chars)",
      },
      { createdAt: "2026-04-08T16:00:02.000Z", message: "@@NODE_START::merge-op" },
      { createdAt: "2026-04-08T16:00:01.000Z", message: "@@NODE_DONE::file-a" },
      { createdAt: "2026-04-08T16:00:00.000Z", message: "@@NODE_START::file-a" },
    ]);

    render(<RunConsole />, { wrapper: timelineWrapper });

    expect(screen.getByText("Current step")).toBeInTheDocument();
    expect(screen.getAllByText("Merge Review").length).toBeGreaterThan(0);
    expect(screen.getByText("Run timeline")).toBeInTheDocument();
    expect(screen.getByText("Output artifacts")).toBeInTheDocument();
    expect(screen.getAllByText(/C:\\tmp\\ordine-output\\review-report.md/).length).toBeGreaterThan(
      0,
    );
    expect(screen.getByText(/wait for all parent inputs/i)).toBeInTheDocument();
  });

  it("keeps bracketed log labels out of the timestamp column", () => {
    useTraceData.mockReturnValue([
      { message: "[Codex] Starting codex exec (cwd=/tmp/ordine-input-repo)" },
    ]);

    render(<RunConsole />, { wrapper: wrapperWithJob("job-1") });

    expect(
      screen.getAllByText("[Codex] Starting codex exec (cwd=/tmp/ordine-input-repo)").length,
    ).toBeGreaterThan(0);
    expect(screen.queryByText("Invalid Date")).not.toBeInTheDocument();
  });
});
