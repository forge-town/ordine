import { render, waitFor } from "@testing-library/react";
import {
  createNotificationStore,
  NotificationStoreContext,
} from "@repo/views/store/notificationStore";
import type { Job } from "@repo/schemas";
import { describe, expect, it, vi } from "vitest";
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

vi.mock("@refinedev/core", () => ({
  useDataProvider: () => () => ({ custom: vi.fn() }),
  useOne: () => ({ query: { data: { data: waitingJob } } }),
  useCustom: () => ({
    result: {
      data: {
        traces: [{ id: 1, level: "info", message: "first trace" }],
      },
    },
  }),
}));

describe("useRunPolling", () => {
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
});
