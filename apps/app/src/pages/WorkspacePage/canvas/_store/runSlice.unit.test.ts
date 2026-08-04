import { createStore } from "zustand/vanilla";
import { describe, expect, it } from "vitest";
import type { Job, JobTrace } from "@repo/schemas";
import { createRunSlice, type RunSlice } from "./runSlice";

const createRunStore = () => createStore<RunSlice>()(createRunSlice<RunSlice>());

const makeJob = (patch: Partial<Job>): Job => ({
  id: "job-1",
  title: "Pipeline run",
  type: "pipeline_run",
  status: "running",
  parentJobId: null,
  pipelineId: "pipeline-1",
  projectId: null,
  nodeStatuses: null,
  error: null,
  startedAt: new Date("2026-06-11T00:00:00Z"),
  finishedAt: null,
  ...patch,
});

const trace: JobTrace = {
  id: 1,
  jobId: "job-1",
  level: "info",
  message: "Started",
  createdAt: new Date("2026-06-11T00:00:00Z"),
};

describe("runSlice", () => {
  it("applies a live job snapshot and normalizes legacy node statuses", () => {
    const store = createRunStore();

    store.getState().applyJobSnapshot(
      makeJob({
        nodeStatuses: {
          input: "done",
          operation: "running",
        },
      }),
    );
    store.getState().setNodeRunStatuses({ ...store.getState().nodeRunStatuses, input: "pass" });

    expect(store.getState().activeJobId).toBe("job-1");
    expect(store.getState().latestJob?.id).toBe("job-1");
    expect(store.getState().nodeRunStatuses).toEqual({
      input: "done",
      operation: "running",
    });
    expect(store.getState().runningNodeId).toBe("operation");
  });

  it("keeps completed jobs as latest but clears the active job", () => {
    const store = createRunStore();

    store.getState().applyJobSnapshot(
      makeJob({
        finishedAt: new Date("2026-06-11T00:01:00Z"),
        status: "done",
      }),
    );

    expect(store.getState().activeJob).toBeNull();
    expect(store.getState().activeJobId).toBeNull();
    expect(store.getState().latestJob?.status).toBe("done");
  });

  it("keeps paused jobs active so they can be resumed", () => {
    const store = createRunStore();

    store.getState().applyJobSnapshot(makeJob({ status: "paused" }));

    expect(store.getState().activeJobId).toBe("job-1");
    expect(store.getState().activeJob?.status).toBe("paused");
  });

  it("derives checkpoint waiting state from waitingForUser node status", () => {
    const store = createRunStore();

    store.getState().applyJobSnapshot(
      makeJob({
        nodeStatuses: {
          checkpoint: "waitingForUser",
        },
      }),
    );

    expect(store.getState().checkpointWait).toEqual({
      jobId: "job-1",
      nodeId: "checkpoint",
    });
  });

  it("marks nodes through the run status helpers", () => {
    const store = createRunStore();

    store.getState().markNodeRunning("operation");
    expect(store.getState().runningNodeId).toBe("operation");

    store.getState().markNodeSucceeded("operation");
    store.getState().markNodeFailed("output");
    store.getState().markNodeSkipped("optional");

    expect(store.getState().nodeRunStatuses).toEqual({
      operation: "done",
      optional: "skipped",
      output: "failed",
    });
    expect(store.getState().runningNodeId).toBeNull();
  });

  it("begins a run by marking the job id and resetting stale state", () => {
    const store = createRunStore();

    store.getState().markNodeFailed("operation");
    store.getState().applyNodeLlmContent("operation", "stale result");
    store.getState().setRunTraces([trace]);
    store.getState().beginRun("job-9");

    expect(store.getState().activeJobId).toBe("job-9");
    expect(store.getState().nodeRunStatuses).toEqual({});
    expect(store.getState().nodeLlmContent).toEqual({});
    expect(store.getState().runTraces).toEqual([]);
    expect(store.getState().checkpointWait).toBeNull();
  });

  it("stores traces, node content, and clears run state", () => {
    const store = createRunStore();

    store.getState().setRunTraces([trace]);
    store.getState().applyNodeLlmContent("operation", "result text");
    store.getState().clearRunState();

    expect(store.getState().runTraces).toEqual([]);
    expect(store.getState().nodeLlmContent).toEqual({});
    expect(store.getState().nodeRunStatuses).toEqual({});
  });
});
