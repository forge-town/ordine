import { vi } from "vitest";
import { okAsync } from "neverthrow";
import type { ExecutionApiService } from "@repo/services";
import {
  EXECUTION_TIMEOUT_DEFAULTS,
  ExecutionApprovalSchema,
  ExecutionArtifactSchema,
  ExecutionEventSchema,
  ExecutionInputAssetSchema,
  ExecutionJobSchema,
  OperationRevisionSchema,
  PipelineDefinitionSchema,
  PreparedRunSchema,
  RunRequestInputSchema,
  RunRequestReceiptSchema,
  SavePipelineDefinitionSchema,
  ExecutionScopeSchema,
  ExecutionRuntimeConfigRecordSchema,
} from "@repo/schemas";

export const agentToken = "a".repeat(32);
export const appToken = "b".repeat(32);
export const principal = {
  subjectId: "owner",
  workspaceId: "workspace-1",
  scopes: ExecutionScopeSchema.options.filter((scope) => scope !== "execution:approve"),
};
export const appPrincipal = { ...principal, scopes: [...ExecutionScopeSchema.options] };
export const auth = {
  mode: "desktop" as const,
  allowedOrigins: ["https://app.example"],
  credentials: [
    { ...principal, audience: "agent" as const, transport: "desktop" as const, token: agentToken },
    { ...appPrincipal, audience: "app" as const, transport: "desktop" as const, token: appToken },
  ],
};
export const readiness = {
  buildRevision: "test",
  instanceId: "11111111-1111-4111-8111-111111111111",
  workspaceId: principal.workspaceId,
  mode: "desktop" as const,
  limits: {
    maxNodes: 200,
    maxEdges: 500,
    maxRequestBytes: 2 * 1024 * 1024,
    maxInlineValueBytes: 256 * 1024,
  },
  probeDatabase: async () => ({ reachable: true, schemaVersion: 2 }),
  listLocalRuntimeIds: async () => [],
};
export const requestId = "11111111-1111-4111-8111-111111111111";
export const operation = OperationRevisionSchema.parse({
  apiVersion: 2,
  id: "op-1",
  revision: 1,
  name: "Identity",
  inputPorts: [],
  outputPorts: [],
  executor: { kind: "builtin", name: "identity" },
});
export const pipeline = PipelineDefinitionSchema.parse({
  apiVersion: 2,
  id: "pipeline-1",
  revision: 1,
  name: "Pipeline",
  graph: {
    schemaVersion: 2,
    inputs: [],
    nodes: [
      { id: "node-1", operation: { operationId: operation.id, revision: operation.revision } },
    ],
    edges: [],
    outputs: [],
  },
});
export const savePipeline = SavePipelineDefinitionSchema.parse({
  apiVersion: 2,
  pipelineId: pipeline.id,
  expectedRevision: 0,
  definition: { name: pipeline.name, graph: pipeline.graph, editor: pipeline.editor },
});
export const submission = RunRequestInputSchema.parse({
  apiVersion: 2,
  requestId,
  pipelineId: pipeline.id,
  expectedRevision: pipeline.revision,
});
export const pending = RunRequestReceiptSchema.parse({
  apiVersion: 2,
  requestId,
  preparedRunId: "prepared-1",
  approvalId: "approval-1",
  state: "awaiting_approval",
  expiresAt: "2026-09-08T15:00:00Z",
});
export const accepted = RunRequestReceiptSchema.parse({
  apiVersion: 2,
  requestId,
  preparedRunId: "prepared-1",
  jobId: "job-1",
  state: "accepted",
  acceptedAt: "2026-09-08T13:00:00Z",
});
export const rejected = RunRequestReceiptSchema.parse({
  apiVersion: 2,
  requestId,
  preparedRunId: "prepared-1",
  approvalId: "approval-1",
  state: "rejected",
  decidedAt: "2026-09-08T13:00:00Z",
});
export const job = ExecutionJobSchema.parse({
  apiVersion: 2,
  id: "job-1",
  preparedRunId: "prepared-1",
  revision: 1,
  state: "succeeded",
  createdAt: "2026-09-08T12:00:00Z",
  startedAt: "2026-09-08T12:00:00Z",
  finishedAt: "2026-09-08T12:01:00Z",
  deadlineAt: null,
  waitingDeadlineAt: null,
  stopReason: null,
  error: null,
  warnings: [],
});
export const event = ExecutionEventSchema.parse({
  sequence: 8,
  jobId: job.id,
  nodeId: null,
  attemptId: null,
  type: "job_completed",
  payload: {},
  createdAt: "2026-09-08T12:01:00Z",
});
export const jobSummary = {
  ...job,
  pipelineId: pipeline.id,
  pipelineName: "Approved pipeline snapshot",
  pipelineRevision: pipeline.revision,
  requestId,
};
export const artifact = ExecutionArtifactSchema.parse({
  artifactId: "artifact-1",
  jobId: job.id,
  nodeId: "node-1",
  portId: "output",
  attemptId: "attempt-1",
  name: "output.bin",
  mimeType: "application/octet-stream",
  sizeBytes: 3,
  sha256: "c".repeat(64),
  state: "published",
  createdAt: "2026-09-08T12:00:00Z",
});
export const asset = ExecutionInputAssetSchema.parse({
  artifactId: "asset-1",
  subjectId: principal.subjectId,
  workspaceId: principal.workspaceId,
  name: "input.bin",
  mimeType: "application/octet-stream",
  sizeBytes: 3,
  sha256: "d".repeat(64),
  createdAt: "2026-09-08T12:00:00Z",
});
export const prepared = PreparedRunSchema.parse({
  apiVersion: 2,
  id: "prepared-1",
  subjectId: principal.subjectId,
  workspaceId: principal.workspaceId,
  createdAt: "2026-09-08T12:00:00Z",
  pipeline,
  operations: [operation],
  resolvedNodes: {
    "node-1": { executorKind: "builtin", timeouts: EXECUTION_TIMEOUT_DEFAULTS, origins: {} },
  },
  inputs: {},
  deliveryRequirements: [],
  risk: { requiresApproval: true, reasons: ["User approval required"] },
  contentHash: "e".repeat(64),
});
export const approval = ExecutionApprovalSchema.parse({
  id: "approval-1",
  requestId,
  expiresAt: "2026-09-08T15:00:00Z",
  state: "pending",
  prepared,
});
export const runtime = ExecutionRuntimeConfigRecordSchema.parse({
  apiVersion: 2,
  revision: 1,
  config: {
    id: "local-codex",
    name: "Codex",
    type: "codex",
    connection: { mode: "local", path: "C:/runtime/codex.exe" },
  },
});
export const settings = { apiVersion: 2 as const, revision: 0, executionDefaults: {} };
export const result = {
  jobId: job.id,
  state: job.state,
  outputs: {},
  artifacts: [artifact],
  warnings: [],
};
export const mockService = () =>
  ({
    saveOperation: vi
      .fn<ExecutionApiService["saveOperation"]>()
      .mockReturnValue(okAsync(operation)),
    savePipeline: vi.fn<ExecutionApiService["savePipeline"]>().mockReturnValue(okAsync(pipeline)),
    submit: vi.fn<ExecutionApiService["submit"]>().mockReturnValue(okAsync(pending)),
    getOperationRevision: vi
      .fn<ExecutionApiService["getOperationRevision"]>()
      .mockReturnValue(okAsync(operation)),
    listOperations: vi
      .fn<ExecutionApiService["listOperations"]>()
      .mockReturnValue(okAsync([operation])),
    listPipelines: vi
      .fn<ExecutionApiService["listPipelines"]>()
      .mockReturnValue(okAsync([pipeline])),
    getPipeline: vi.fn<ExecutionApiService["getPipeline"]>().mockReturnValue(okAsync(pipeline)),
    getRequest: vi.fn<ExecutionApiService["getRequest"]>().mockReturnValue(okAsync(accepted)),
    listJobs: vi.fn<ExecutionApiService["listJobs"]>().mockReturnValue(okAsync([job])),
    listJobSummaries: vi
      .fn<ExecutionApiService["listJobSummaries"]>()
      .mockReturnValue(okAsync([jobSummary])),
    getJobSummary: vi
      .fn<ExecutionApiService["getJobSummary"]>()
      .mockReturnValue(okAsync(jobSummary)),
    getJob: vi.fn<ExecutionApiService["getJob"]>().mockReturnValue(okAsync(job)),
    getEvents: vi.fn<ExecutionApiService["getEvents"]>().mockReturnValue(okAsync([event])),
    getResult: vi.fn<ExecutionApiService["getResult"]>().mockReturnValue(okAsync(result)),
    listArtifacts: vi
      .fn<ExecutionApiService["listArtifacts"]>()
      .mockReturnValue(okAsync([artifact])),
    getArtifact: vi.fn<ExecutionApiService["getArtifact"]>().mockReturnValue(okAsync(artifact)),
    readArtifact: vi.fn<ExecutionApiService["readArtifact"]>().mockReturnValue(
      okAsync({
        metadata: artifact,
        bytes: Uint8Array.of(0, 255, 128),
        offset: 0,
        totalSizeBytes: 3,
      }),
    ),
    importInput: vi.fn<ExecutionApiService["importInput"]>().mockReturnValue(okAsync(asset)),
    controlJob: vi.fn<ExecutionApiService["controlJob"]>().mockReturnValue(okAsync(job)),
    ackCheckpoint: vi.fn<ExecutionApiService["ackCheckpoint"]>().mockReturnValue(okAsync(job)),
    approve: vi.fn<ExecutionApiService["approve"]>().mockReturnValue(okAsync(accepted)),
    reject: vi.fn<ExecutionApiService["reject"]>().mockReturnValue(okAsync(rejected)),
    getApproval: vi.fn<ExecutionApiService["getApproval"]>().mockReturnValue(okAsync(approval)),
    listRuntimeConfigs: vi
      .fn<ExecutionApiService["listRuntimeConfigs"]>()
      .mockReturnValue(okAsync([runtime])),
    saveRuntimeConfig: vi
      .fn<ExecutionApiService["saveRuntimeConfig"]>()
      .mockReturnValue(okAsync(runtime)),
    getWorkspaceSettings: vi
      .fn<ExecutionApiService["getWorkspaceSettings"]>()
      .mockReturnValue(okAsync(settings)),
    saveWorkspaceSettings: vi
      .fn<ExecutionApiService["saveWorkspaceSettings"]>()
      .mockReturnValue(okAsync(settings)),
  }) satisfies ExecutionApiService;
