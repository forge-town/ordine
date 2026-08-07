import { render, waitFor } from "@testing-library/react";
import {
  createNotificationStore,
  NotificationStoreContext,
} from "@repo/views/store/notificationStore";
import type { Job } from "@repo/schemas";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CanvasStoreContext, createCanvasStore } from "../_store/canvasStore";
import { RunPoller, isTerminalJobStatus } from "./useRunPolling";

const waitingJob: Job = {
  error: null,
  finishedAt: null,
  id: "job-1",
  nodeStatuses: { checkpoint: "waitingForUser" },
  parentJobId: null,
  pipelineId: "pipeline-1",
  projectId: null,
  startedAt: new Date(),
  status: "running",
  title: "Run",
  type: "pipeline_run",
};

const currentJob: { value: Job } = { value: waitingJob };

vi.mock("@refinedev/core", () => ({
  useDataProvider: () => () => ({ custom: vi.fn() }),
  useOne: () => ({ query: { data: { data: currentJob.value } } }),
  useCustom: ({ queryOptions }: { queryOptions: { enabled: boolean } }) => ({
    result: queryOptions.enabled
      ? { data: { traces: [{ id: 1, level: "info", message: "first trace" }] } }
      : {},
  }),
}));

describe("useRunPolling", () => {
  beforeEach(() => {
    currentJob.value = waitingJob;
  });

  it("syncs the job, checkpoint and traces into the canvas store", async () => {
    const canvasStore = createCanvasStore();
    canvasStore.getState().beginRun("job-1");
    const notificationStore = createNotificationStore();

    render(
      <NotificationStoreContext.Provider value={notificationStore}>
        <CanvasStoreContext.Provider value={canvasStore}>
          <RunPoller />
        </CanvasStoreContext.Provider>
      </NotificationStoreContext.Provider>,
    );

    await waitFor(() => {
      expect(canvasStore.getState().checkpointWait).toEqual({
        jobId: "job-1",
        nodeId: "checkpoint",
      });
      expect(canvasStore.getState().runTraces[0]?.message).toBe("first trace");
    });
  });

  it("recognizes all terminal statuses", () => {
    expect(isTerminalJobStatus("done")).toBe(true);
    expect(isTerminalJobStatus("skipped")).toBe(true);
    expect(isTerminalJobStatus("running")).toBe(false);
  });

  it("preserves traces after the active job reaches a terminal status", async () => {
    currentJob.value = { ...waitingJob, finishedAt: new Date(), status: "done" };
    const canvasStore = createCanvasStore();
    canvasStore.getState().beginRun("job-1");
    const notificationStore = createNotificationStore();

    render(
      <NotificationStoreContext.Provider value={notificationStore}>
        <CanvasStoreContext.Provider value={canvasStore}>
          <RunPoller />
        </CanvasStoreContext.Provider>
      </NotificationStoreContext.Provider>,
    );

    await waitFor(() => {
      expect(canvasStore.getState().activeJobId).toBeNull();
      expect(canvasStore.getState().runTraces[0]?.message).toBe("first trace");
    });
  });
});
