import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { Job, JobTrace } from "@repo/schemas";
import { CanvasStoreContext, createCanvasStore, type CanvasStore } from "../_store/canvasStore";
import { RunConsole } from "./RunConsole";

const runningJob: Job = {
  error: null,
  finishedAt: null,
  id: "job-1",
  nodeStatuses: { "node-op": "running" },
  parentJobId: null,
  pipelineId: "pipeline-1",
  projectId: null,
  startedAt: new Date(),
  status: "running",
  title: "Run",
  type: "pipeline_run",
};

const traces: JobTrace[] = [
  { createdAt: new Date(), id: 1, jobId: "job-1", level: "info", message: "parsing 1..12" },
];

const makeWrapper =
  (store: CanvasStore) =>
  ({ children }: { children: React.ReactNode }) => (
    <CanvasStoreContext.Provider value={store}>{children}</CanvasStoreContext.Provider>
  );

describe("RunConsole", () => {
  it("renders nothing without a job", () => {
    const store = createCanvasStore();
    render(<RunConsole />, { wrapper: makeWrapper(store) });

    expect(screen.queryByTestId("canvas-v2-run-console")).not.toBeInTheDocument();
  });

  it("streams trace lines and supports collapsing", async () => {
    const user = userEvent.setup();
    const store = createCanvasStore();
    store.getState().applyJobSnapshot(runningJob);
    store.getState().setRunTraces(traces);
    render(<RunConsole />, { wrapper: makeWrapper(store) });

    expect(screen.getByText("parsing 1..12")).toBeInTheDocument();
    await user.click(screen.getByTestId("run-console-toggle"));
    expect(screen.queryByText("parsing 1..12")).not.toBeInTheDocument();
  });

  it("hides structured trace protocol payloads", () => {
    const store = createCanvasStore();
    store.getState().applyJobSnapshot(runningJob);
    store.getState().setRunTraces([
      ...traces,
      {
        createdAt: new Date(),
        id: 2,
        jobId: "job-1",
        level: "info",
        message: "@@LLM_CONTENT::node-op::private streamed content",
      },
    ]);
    render(<RunConsole />, { wrapper: makeWrapper(store) });

    expect(screen.getByText("parsing 1..12")).toBeInTheDocument();
    expect(screen.queryByText(/private streamed content/)).not.toBeInTheDocument();
  });

  it("can be dismissed after the job finishes", async () => {
    const user = userEvent.setup();
    const store = createCanvasStore();
    store.getState().applyJobSnapshot({ ...runningJob, finishedAt: new Date(), status: "done" });
    render(<RunConsole />, { wrapper: makeWrapper(store) });

    await user.click(screen.getByTestId("run-console-dismiss"));
    expect(screen.queryByTestId("canvas-v2-run-console")).not.toBeInTheDocument();
  });
});
