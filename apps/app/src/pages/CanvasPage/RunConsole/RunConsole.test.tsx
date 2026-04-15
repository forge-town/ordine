import { render, screen, waitFor, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { RunConsole } from "./RunConsole";
import { HarnessCanvasStoreProvider } from "../_store";

vi.mock("@xyflow/react", () => ({
  Handle: () => null,
  Position: { Top: "top", Bottom: "bottom", Left: "left", Right: "right" },
  ReactFlowProvider: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <HarnessCanvasStoreProvider>{children}</HarnessCanvasStoreProvider>
);

const mockJobRunning = {
  id: "job-1",
  title: "Pipeline run",
  type: "pipeline_run",
  status: "running",
  logs: [
    "[2026-04-08T16:00:00.000Z] Starting pipeline abc",
    "[2026-04-08T16:00:01.000Z] Processing node [github-project] skills",
  ],
  result: null,
  error: null,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  startedAt: Date.now(),
  finishedAt: null,
  projectId: null,
  pipelineId: null,
};

const mockJobDone = {
  ...mockJobRunning,
  status: "done",
  logs: [...mockJobRunning.logs, "[2026-04-08T16:00:05.000Z] Pipeline complete"],
  finishedAt: Date.now(),
  result: { summary: "Output written to /Users/test/Desktop/output.md" },
};

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(mockJobRunning),
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("RunConsole", () => {
  it("renders nothing when jobId is null", () => {
    const { container } = render(<RunConsole jobId={null} />, { wrapper });
    expect(container.firstChild).toBeNull();
  });

  it("shows status bar with running indicator", async () => {
    render(<RunConsole jobId="job-1" />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText(/running/i)).toBeInTheDocument();
    });
  });

  it("displays log entries from the job", async () => {
    render(<RunConsole jobId="job-1" />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText(/Starting pipeline/)).toBeInTheDocument();
      expect(screen.getByText(/Processing node/)).toBeInTheDocument();
    });
  });

  it("shows done status when job completes", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockJobDone),
    });

    render(<RunConsole jobId="job-1" />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText(/done/i)).toBeInTheDocument();
    });
  });

  it("polls for updates while running", async () => {
    render(<RunConsole jobId="job-1" />, { wrapper });

    // Wait for initial fetch
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    // Advance timer to trigger next poll
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    });
  });

  it("stops polling when job is done", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockJobDone),
    });

    render(<RunConsole jobId="job-1" />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText(/done/i)).toBeInTheDocument();
    });

    const callCount = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length;

    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    // Should not have polled again
    expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(callCount);
  });
});
