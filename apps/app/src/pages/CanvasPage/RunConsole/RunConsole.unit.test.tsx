import { render } from "@/test/test-wrapper";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RunConsole } from "./RunConsole";
import { HarnessCanvasStoreProvider } from "../_store";

vi.mock("@xyflow/react", () => ({
  Handle: () => null,
  Position: { Top: "top", Bottom: "bottom", Left: "left", Right: "right" },
  ReactFlowProvider: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

const wrapper = ({ children }: { children?: React.ReactNode }) => (
  <HarnessCanvasStoreProvider>{children}</HarnessCanvasStoreProvider>
);

const mockJobRunning = {
  id: "job-1",
  title: "Pipeline run",
  type: "pipeline_run",
  status: "running" as string,
  logs: [
    "[2026-04-08T16:00:00.000Z] Starting pipeline abc",
    "[2026-04-08T16:00:01.000Z] Processing node [github-project] skills",
  ],
  result: null as Record<string, unknown> | null,
  error: null,
  meta: { createdAt: new Date(), updatedAt: new Date() },
  startedAt: Date.now(),
  finishedAt: null as number | null,
  projectId: null,
  pipelineId: null,
};

const mockJobDone = {
  ...mockJobRunning,
  status: "done" as const,
  logs: [...mockJobRunning.logs, "[2026-04-08T16:00:05.000Z] Pipeline complete"],
  finishedAt: Date.now(),
  result: { summary: "Output written to /Users/test/Desktop/output.md" },
};

const useOneData = vi.fn(() => mockJobRunning);

vi.mock("@refinedev/core", () => ({
  useOne: () => ({
    query: {
      data: { data: useOneData() },
      isLoading: false,
    },
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
    const { container } = render(<RunConsole jobId={null} />, { wrapper });
    expect(container.firstChild).toBeNull();
  });

  it("shows status bar with running indicator", () => {
    render(<RunConsole jobId="job-1" />, { wrapper });
    expect(screen.getByText(/Running/i)).toBeInTheDocument();
  });

  it("displays log entries from the job", () => {
    render(<RunConsole jobId="job-1" />, { wrapper });
    expect(screen.getByText(/Starting pipeline/)).toBeInTheDocument();
    expect(screen.getByText(/Processing node/)).toBeInTheDocument();
  });

  it("shows done status when job completes", () => {
    useOneData.mockReturnValue(mockJobDone);
    render(<RunConsole jobId="job-1" />, { wrapper });
    expect(screen.getByText(/Done/i)).toBeInTheDocument();
    useOneData.mockReturnValue(mockJobRunning);
  });

  it("polls for updates while running", () => {
    render(<RunConsole jobId="job-1" />, { wrapper });
    expect(screen.getByText(/Running/i)).toBeInTheDocument();
  });

  it("stops polling when job is done", () => {
    useOneData.mockReturnValue(mockJobDone);
    render(<RunConsole jobId="job-1" />, { wrapper });
    expect(screen.getByText(/Done/i)).toBeInTheDocument();
    useOneData.mockReturnValue(mockJobRunning);
  });
});
