import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DataProvider } from "@refinedev/core";
import { ExecutionJobSchema, PipelineDefinitionSchema, type RunRequestInput } from "@repo/schemas";
import {
  setCanvasDataProvider,
  setCanvasExecutionDataProvider,
} from "../../../lib/canvasDataProvider";
import { createCanvasPageStore } from "./canvasPageStore";
import { ExecutionHttpError } from "../../../execution/dataProvider";

const pipeline = PipelineDefinitionSchema.parse({
  apiVersion: 2,
  id: "draft",
  revision: 7,
  name: "Published",
  graph: {
    schemaVersion: 2,
    inputs: [],
    nodes: [{ id: "node", operation: { operationId: "op", revision: 1 } }],
    edges: [],
    outputs: [],
  },
});
const job = ExecutionJobSchema.parse({
  apiVersion: 2,
  id: "v2-job",
  preparedRunId: "prepared",
  revision: 1,
  state: "cancelling",
  createdAt: "2026-09-08T00:00:00Z",
  startedAt: null,
  finishedAt: null,
  deadlineAt: null,
  waitingDeadlineAt: null,
  stopReason: "cancelled",
  error: null,
  warnings: [],
});
const draft = {
  update: vi.fn(async () => ({ data: {} })),
  custom: vi.fn(async () => ({
    data: { pipeline, inputs: {}, executionOverrides: { firstOutputTimeoutMs: 1500 } },
  })),
};
const execution = {
  create: vi.fn(async ({ resource, variables }: { resource: string; variables: unknown }) => ({
    data:
      resource === "run-requests"
        ? {
            apiVersion: 2,
            requestId: (variables as RunRequestInput).requestId,
            state: "accepted",
            preparedRunId: "prepared",
            jobId: job.id,
            acceptedAt: "2026-09-08T00:00:00Z",
          }
        : job,
  })),
};
beforeEach(() => {
  sessionStorage.clear();
  vi.clearAllMocks();
  setCanvasDataProvider(draft as unknown as DataProvider);
  setCanvasExecutionDataProvider(execution as unknown as DataProvider);
});

describe("Canvas v2 execution submission", () => {
  it("omits untouched global defaults and preserves a timeout-only zero override", async () => {
    const untouched = createCanvasPageStore([], [], "draft", "Canvas");
    await untouched.getState().handleRunTest(null);
    expect(draft.custom).toHaveBeenNthCalledWith(1, {
      url: "execution/publish-canvas",
      method: "post",
      payload: { pipelineId: "draft", executionOverrides: {} },
    });
    sessionStorage.clear();
    const explicit = createCanvasPageStore([], [], "draft", "Canvas");
    await explicit.getState().handleRunTest({ firstOutputTimeoutSeconds: 0 });
    expect(draft.custom).toHaveBeenNthCalledWith(2, {
      url: "execution/publish-canvas",
      method: "post",
      payload: { pipelineId: "draft", executionOverrides: { firstOutputTimeoutMs: 0 } },
    });
  });
  it("allows a repaired retry after an explicit server validation rejection", async () => {
    execution.create.mockRejectedValueOnce(
      new ExecutionHttpError("Invalid runtime", 422, "INVALID_RUNTIME"),
    );
    const store = createCanvasPageStore([], [], "draft", "Canvas");
    await store.getState().handleRunTest();
    expect(store.getState().executionSubmission.phase).toBe("idle");
    expect(store.getState().isRunning).toBe(false);
    expect(sessionStorage.getItem("ordine.canvas.execution:draft")).toBeNull();
    await store.getState().handleRunTest();
    expect(execution.create).toHaveBeenCalledTimes(2);
  });
  it("saves the draft, publishes with milliseconds, and submits the exact returned revision/options once", async () => {
    const store = createCanvasPageStore([], [], "draft", "Canvas");
    await Promise.all([
      store.getState().handleRunTest({
        runtimeConfigId: "runtime",
        model: "model",
        firstOutputTimeoutSeconds: 0,
      }),
      store.getState().handleRunTest(),
    ]);
    expect(draft.update).toHaveBeenCalledOnce();
    expect(draft.custom).toHaveBeenCalledWith({
      url: "execution/publish-canvas",
      method: "post",
      payload: {
        pipelineId: "draft",
        executionOverrides: { runtimeConfigId: "runtime", model: "model", firstOutputTimeoutMs: 0 },
      },
    });
    expect(execution.create).toHaveBeenCalledOnce();
    expect(execution.create.mock.calls[0]?.[0]).toMatchObject({
      resource: "run-requests",
      variables: {
        pipelineId: pipeline.id,
        expectedRevision: 7,
        executionOverrides: { firstOutputTimeoutMs: 1500 },
      },
    });
    expect(store.getState()).toMatchObject({
      activeJobId: job.id,
      isTestRunning: true,
      runSyncJobId: null,
    });
    expect(JSON.parse(sessionStorage.getItem("ordine.canvas.execution:draft")!)).toEqual({
      apiVersion: 2,
      requestId: store.getState().executionSubmission.request!.requestId,
      pipelineId: "draft",
      expectedRevision: 7,
    });
  });
  it("allows retry before submission when publication fails", async () => {
    draft.custom.mockRejectedValueOnce(new Error("invalid graph"));
    const store = createCanvasPageStore([], [], "draft", "Canvas");
    await store.getState().handleRunTest();
    expect(store.getState().isRunning).toBe(false);
    expect(execution.create).not.toHaveBeenCalled();
    await store.getState().handleRunTest();
    expect(execution.create).toHaveBeenCalledOnce();
  });
  it("retains the original request after uncertain submission and reload, never republishes or creates another", async () => {
    execution.create.mockRejectedValueOnce(new Error("connection lost after commit"));
    const store = createCanvasPageStore([], [], "draft", "Canvas");
    await store.getState().handleRunTest();
    expect(store.getState().executionSubmission.phase).toBe("uncertain");
    const requestId = store.getState().executionSubmission.request!.requestId;
    await store.getState().handleRunTest();
    const reloaded = createCanvasPageStore([], [], "draft", "Canvas");
    await reloaded.getState().handleRunTest();
    expect(reloaded.getState().executionSubmission.request?.requestId).toBe(requestId);
    expect(execution.create).toHaveBeenCalledOnce();
    expect(draft.custom).toHaveBeenCalledOnce();
  });
  it("keeps approval pending locked, accepts the same request, and cancels through v2 without claiming completion", async () => {
    execution.create.mockImplementationOnce(
      async ({ variables }) =>
        ({
          data: {
            apiVersion: 2,
            requestId: (variables as RunRequestInput).requestId,
            state: "awaiting_approval",
            preparedRunId: "prepared",
            approvalId: "approval",
            expiresAt: "2026-09-09T00:00:00Z",
          },
        }) as never,
    );
    const store = createCanvasPageStore([], [], "draft", "Canvas");
    await store.getState().handleRunTest();
    await store.getState().handleRunTest();
    expect(execution.create).toHaveBeenCalledOnce();
    const requestId = store.getState().executionSubmission.request!.requestId;
    store.getState().receiveExecutionReceipt({
      apiVersion: 2,
      requestId,
      state: "accepted",
      preparedRunId: "prepared",
      jobId: job.id,
      acceptedAt: "2026-09-08T00:00:00Z",
    });
    await expect(store.getState().handleCancelRun()).resolves.toBe(true);
    expect(execution.create).toHaveBeenLastCalledWith({
      resource: "job-control",
      variables: { jobId: job.id, action: "cancel" },
    });
    expect(store.getState().isTestRunning).toBe(true);
    store.getState().receiveExecutionJob({ ...job, state: "cancelled" });
    expect(store.getState().isTestRunning).toBe(false);
  });
});
