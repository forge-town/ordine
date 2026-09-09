import { Result, ResultAsync } from "neverthrow";
import { z } from "zod/v4";
import {
  ExecutionOverridesSchema,
  ExecutionPortValuesSchema,
  PipelineDefinitionSchema,
  RunRequestInputSchema,
  RunRequestReceiptSchema,
  type AgentExecutionChoice,
  type ExecutionJob,
  type ExecutionEvent,
  type NodeRunStatus,
  type RunRequestReceipt,
} from "@repo/schemas";
import {
  beginSubmission,
  idleSubmission,
  receiveReceipt,
  uncertainSubmission,
  type SubmissionState,
} from "../../../execution/submission";
import {
  getCanvasDataProvider,
  getCanvasExecutionDataProvider,
} from "../../../lib/canvasDataProvider";
import { terminalStates } from "../../ExecutionWorkspacePage/useJobData";
import { ExecutionHttpError } from "../../../execution/dataProvider";
import { ResourceName } from "../../../constants";
import type { CanvasPageStoreSlice } from "./canvasPageStore";

const PublishedCanvasSchema = z.strictObject({
  pipeline: PipelineDefinitionSchema,
  executionOverrides: ExecutionOverridesSchema,
  inputs: ExecutionPortValuesSchema,
});
const storageKey = (id: string) => `ordine.canvas.execution:${id}`;
const persist = (pipelineId: string, state: SubmissionState) =>
  Result.fromThrowable(
    () => {
      if (typeof sessionStorage !== "undefined" && state.request)
        sessionStorage.setItem(
          storageKey(pipelineId),
          JSON.stringify({
            apiVersion: 2,
            requestId: state.request.requestId,
            pipelineId: state.request.pipelineId,
            expectedRevision: state.request.expectedRevision,
          }),
        );
      else if (typeof sessionStorage !== "undefined")
        sessionStorage.removeItem(storageKey(pipelineId));
    },
    () => new Error("无法保存本次请求标识，尚未提交运行。"),
  )();
const restore = (pipelineId: string | null): SubmissionState => {
  if (!pipelineId || typeof sessionStorage === "undefined") return idleSubmission();
  const result = Result.fromThrowable(
    () =>
      RunRequestInputSchema.parse(
        JSON.parse(sessionStorage.getItem(storageKey(pipelineId)) ?? "null"),
      ),
    () => null,
  )();
  if (result.isErr()) return idleSubmission();

  if (result.value.pipelineId !== pipelineId) return idleSubmission();

  return uncertainSubmission(
    beginSubmission(idleSubmission(), result.value),
    "请查询原请求以恢复提交结果。",
  );
};
const pending = (submission: SubmissionState, job: ExecutionJob | null): boolean =>
  ["submitting", "uncertain", "awaiting_approval"].includes(submission.phase) ||
  (submission.phase === "accepted" && (!job || !terminalStates.includes(job.state)));

export interface CanvasExecutionSlice {
  executionSubmission: SubmissionState;
  executionJob: ExecutionJob | null;
  executionError: string | null;
  executionControlPending: boolean;
  receiveExecutionReceipt: (receipt: RunRequestReceipt) => void;
  receiveExecutionJob: (job: ExecutionJob) => void;
  receiveExecutionEvents: (events: ExecutionEvent[]) => void;
  handleRunTest: (choice?: Partial<AgentExecutionChoice> | null) => Promise<void>;
  handleCancelRun: () => Promise<boolean>;
}

export const createCanvasExecutionSlice = (
  set: Parameters<CanvasPageStoreSlice>[0],
  get: Parameters<CanvasPageStoreSlice>[1],
  pipelineId: string | null,
): CanvasExecutionSlice => ({
  executionSubmission: restore(pipelineId),
  executionJob: null,
  executionError: null,
  executionControlPending: false,
  receiveExecutionEvents: (events) => {
    const current = get();
    const receipt = current.executionSubmission.receipt;
    if (receipt?.state !== "accepted") return;
    const statuses = { ...current.nodeRunStatuses };
    const mapping: Record<string, NodeRunStatus> = {
      queued: "queued",
      running: "running",
      succeeded: "done",
      failed: "failed",
      skipped: "skipped",
      cancelled: "cancelled",
      interrupted: "failed",
      timed_out: "failed",
      waiting_for_input: "waitingForUser",
    };
    for (const event of [...events].sort((left, right) => left.sequence - right.sequence)) {
      if (
        event.jobId !== receipt.jobId ||
        !event.nodeId ||
        event.type !== "node_state" ||
        typeof event.payload.state !== "string"
      )
        continue;
      const status = mapping[event.payload.state];
      if (status && current.nodes.some((node) => node.id === event.nodeId))
        statuses[event.nodeId] = status;
    }
    current.setNodeRunStatuses(statuses);
  },
  receiveExecutionReceipt: (receipt) => {
    const current = get();
    const submission = receiveReceipt(current.executionSubmission, receipt);
    if (current.pipelineId) persist(current.pipelineId, submission);
    set({
      executionSubmission: submission,
      executionError: submission.error,
      activeJobId: submission.receipt?.state === "accepted" ? submission.receipt.jobId : null,
      isRunning: ["submitting", "uncertain", "awaiting_approval"].includes(submission.phase),
      isTestRunning:
        submission.phase === "accepted" &&
        (!current.executionJob || !terminalStates.includes(current.executionJob.state)),
    });
    if (
      submission.receipt?.state === "accepted" &&
      current.executionJob?.id === submission.receipt.jobId
    )
      get().receiveExecutionJob(current.executionJob);
  },
  receiveExecutionJob: (job) => {
    const receipt = get().executionSubmission.receipt;
    if (get().activeJobId !== job.id && receipt?.state === "accepted" && receipt.jobId !== job.id)
      return;
    set({
      executionJob: job,
      ...(receipt?.state === "accepted" && receipt.jobId === job.id
        ? {
            activeJobId: job.id,
            isRunning: false,
            isTestRunning: !terminalStates.includes(job.state),
          }
        : {}),
    });
  },
  handleRunTest: async (choice) => {
    const state = get();
    if (
      state.isRunning ||
      state.isTestRunning ||
      pending(state.executionSubmission, state.executionJob)
    )
      return;
    if (!state.pipelineId) {
      set({ executionError: "请先保存 Pipeline。", isConsoleOpen: true });

      return;
    }
    set({
      isRunning: true,
      executionError: null,
      executionJob: null,
      activeJobId: null,
      runSyncJobId: null,
      nodeRunStatuses: {},
      runningNodeId: null,
      isConsoleOpen: true,
      isConsoleCollapsed: false,
      executionSubmission: idleSubmission(),
    });
    const result = await ResultAsync.fromPromise(
      Promise.resolve().then(async () => {
        const provider = getCanvasDataProvider();
        await provider.update({
          resource: ResourceName.pipelines,
          id: state.pipelineId!,
          variables: {
            name: state.pipelineName,
            sharedContext: state.pipelineSharedContext,
            nodes: state.nodes,
            edges: state.edges,
          },
        });
        const executionOverrides = ExecutionOverridesSchema.parse(
          Object.fromEntries(
            Object.entries({
              runtimeConfigId: choice?.runtimeConfigId,
              model: choice?.model,
              reasoningEffort: choice?.reasoningEffort,
              speed: choice?.speed,
              firstOutputTimeoutMs:
                choice?.firstOutputTimeoutSeconds === undefined
                  ? undefined
                  : choice.firstOutputTimeoutSeconds * 1000,
            }).filter(([, value]) => value !== undefined),
          ),
        );
        if (!provider.custom) throw new Error("Canvas 发布服务不可用。");
        const published = PublishedCanvasSchema.parse(
          (
            await provider.custom({
              url: "execution/publish-canvas",
              method: "post",
              payload: { pipelineId: state.pipelineId, executionOverrides },
            })
          ).data,
        );
        const request = RunRequestInputSchema.parse({
          apiVersion: 2,
          requestId: crypto.randomUUID(),
          pipelineId: published.pipeline.id,
          expectedRevision: published.pipeline.revision,
          executionOverrides: published.executionOverrides,
          inputs: published.inputs,
        });
        const submission = beginSubmission(idleSubmission(), request);
        const stored = persist(state.pipelineId!, submission);
        if (stored.isErr()) throw stored.error;
        set({ executionSubmission: submission });
        const response = await getCanvasExecutionDataProvider().create({
          resource: "run-requests",
          variables: request,
        });
        get().receiveExecutionReceipt(RunRequestReceiptSchema.parse(response.data));
      }),
      (error) => (error instanceof Error ? error : new Error("运行请求失败，请查询原请求。")),
    );
    if (result.isErr()) {
      const current = get();
      const rejectedBeforeCommit =
        result.error instanceof ExecutionHttpError &&
        [400, 401, 403, 404, 409, 413, 415, 422, 429].includes(result.error.statusCode);
      const submission = rejectedBeforeCommit
        ? idleSubmission()
        : current.executionSubmission.phase === "submitting"
          ? uncertainSubmission(current.executionSubmission, result.error.message)
          : current.executionSubmission;
      if (state.pipelineId) persist(state.pipelineId, submission);
      set({
        executionSubmission: submission,
        executionError: result.error.message,
        isRunning: pending(submission, current.executionJob),
        isTestRunning: false,
      });
    }
  },
  handleCancelRun: async () => {
    const state = get();
    if (
      !state.activeJobId ||
      !state.isTestRunning ||
      state.executionControlPending ||
      state.executionJob?.state === "cancelling"
    )
      return false;
    set({ executionControlPending: true });
    const result = await ResultAsync.fromPromise(
      Promise.resolve().then(() =>
        getCanvasExecutionDataProvider().create<ExecutionJob>({
          resource: "job-control",
          variables: { jobId: state.activeJobId, action: "cancel" },
        }),
      ),
      () => "停止结果暂时无法确认，请查询当前运行。",
    );
    set({ executionControlPending: false });
    if (result.isErr()) {
      set({ executionError: result.error });

      return false;
    }
    get().receiveExecutionJob(result.value.data);

    return true;
  },
});
