import { createStore } from "zustand/vanilla";
import { Result } from "neverthrow";
import { z } from "zod";
import {
  PipelineDefinitionSchema,
  OperationRevisionSchema,
  ExecutionPortValuesSchema,
  ExecutionOverridesSchema,
  ExecutionDeliveryRequirementSchema,
  type PipelineDefinition,
  type OperationRevision,
  type RunRequestInput,
  type RunRequestReceipt,
} from "@repo/schemas";
import {
  SubmissionSchema,
  idleSubmission,
  beginSubmission,
  receiveReceipt,
  uncertainSubmission,
} from "../../../execution/submission";

const WorkspaceStateSchema = z.object({
  selectedPipelineId: z.string().nullable(),
  selectedJobId: z.string().nullable(),
  draft: PipelineDefinitionSchema.nullable(),
  dirty: z.boolean(),
  selectedNodeId: z.string().nullable(),
  operationDraft: OperationRevisionSchema.nullable(),
  tab: z.enum(["pipeline", "operations", "run"]),
  inputs: ExecutionPortValuesSchema,
  executionOverrides: ExecutionOverridesSchema,
  deliveryRequirements: z.array(ExecutionDeliveryRequirementSchema),
  submission: SubmissionSchema,
  pendingAction: z.string().nullable(),
  error: z.string().nullable(),
  notice: z.string().nullable(),
});
type WorkspaceData = z.infer<typeof WorkspaceStateSchema>;
export type WorkspaceStore = WorkspaceData & {
  patch: (value: Partial<WorkspaceData>) => void;
  edit: (pipeline: PipelineDefinition) => void;
  choosePipeline: (pipeline: PipelineDefinition) => void;
  startRequest: (request: RunRequestInput) => boolean;
  acceptReceipt: (receipt: RunRequestReceipt) => void;
  failRequest: (message: string, definitive?: boolean) => void;
  resetRequest: () => void;
};
const remember = (request: RunRequestInput | null, storageKey: string | null) =>
  Result.fromThrowable(
    () => {
      if (!storageKey || typeof sessionStorage === "undefined") return;
      if (request)
        sessionStorage.setItem(
          storageKey,
          JSON.stringify({
            apiVersion: 2,
            requestId: request.requestId,
            pipelineId: request.pipelineId,
            expectedRevision: request.expectedRevision,
          }),
        );
      else sessionStorage.removeItem(storageKey);
    },
    () => undefined,
  )();
const restore = (storageKey: string | null) =>
  Result.fromThrowable(
    () => {
      if (!storageKey || typeof sessionStorage === "undefined") return null;
      const raw = sessionStorage.getItem(storageKey);

      return raw ? SubmissionSchema.shape.request.parse(JSON.parse(raw)) : null;
    },
    () => null,
  )().unwrapOr(null);

export const createExecutionWorkspaceStore = (initialPipelineId?: string, recoveryKey?: string) => {
  const storageKey = recoveryKey
    ? `ordine.execution.v2.request:${encodeURIComponent(recoveryKey)}`
    : null;
  const request = restore(storageKey);

  return createStore<WorkspaceStore>((set, get) => ({
    selectedJobId: null,
    selectedPipelineId: initialPipelineId ?? request?.pipelineId ?? null,
    draft: null,
    dirty: false,
    selectedNodeId: null,
    operationDraft: null,
    tab: "pipeline",
    inputs: {},
    executionOverrides: {},
    deliveryRequirements: [],
    submission: request
      ? {
          phase: "uncertain",
          request,
          receipt: null,
          error: "发现未确认的请求，请查询原 requestId 恢复。",
        }
      : idleSubmission(),
    pendingAction: null,
    error: null,
    notice: null,
    patch: (value) => set(value),
    edit: (draft) => set({ draft, selectedPipelineId: draft.id, dirty: true, error: null }),
    choosePipeline: (draft) =>
      set({
        draft,
        selectedPipelineId: draft.id,
        selectedNodeId: null,
        dirty: false,
        inputs: {},
        deliveryRequirements: [],
        error: null,
      }),
    startRequest: (request) => {
      const before = get().submission;
      const submission = beginSubmission(before, request);
      if (before === submission) return false;
      remember(request, storageKey);
      set({ submission });

      return true;
    },
    acceptReceipt: (receipt) => {
      const submission = receiveReceipt(get().submission, receipt);
      set({
        submission,
        ...(submission.phase === "accepted" && submission.receipt?.state === "accepted"
          ? { selectedJobId: submission.receipt.jobId }
          : {}),
      });
    },
    failRequest: (message, definitive = false) => {
      if (definitive) remember(null, storageKey);
      set({
        submission: definitive
          ? { ...get().submission, phase: "invalid", error: message, receipt: null }
          : uncertainSubmission(get().submission, message),
      });
    },
    resetRequest: () => {
      remember(null, storageKey);
      set({ submission: idleSubmission() });
    },
  }));
};
export const newPipeline = (): PipelineDefinition => ({
  apiVersion: 2,
  id: `pipeline-${crypto.randomUUID()}`,
  revision: 0,
  name: "新 Pipeline",
  description: "",
  sharedContext: "",
  graph: { schemaVersion: 2, inputs: [], nodes: [], edges: [], outputs: [] },
  editor: { schemaVersion: 2, nodePositions: {}, groups: [], viewport: { x: 0, y: 0, zoom: 1 } },
});
export const newOperation = (): OperationRevision => ({
  apiVersion: 2,
  id: `operation-${crypto.randomUUID()}`,
  revision: 0,
  name: "新 Operation",
  description: "",
  inputPorts: [
    { id: "input", valueType: "text", cardinality: "one", required: true, allowEmpty: false },
  ],
  outputPorts: [
    { id: "output", valueType: "text", cardinality: "one", required: true, allowEmpty: false },
  ],
  executor: { kind: "builtin", name: "identity", config: {} },
  executionDefaults: {},
  capabilityRefs: [],
});
