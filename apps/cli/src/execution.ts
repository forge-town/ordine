import { z } from "zod";
import {
  ExecutionIdentifierSchema,
  ExecutionRequestIdSchema,
  ExecutionReadinessSchema,
  OperationRevisionSchema,
  PipelineDefinitionSchema,
  SavePipelineDefinitionSchema,
  RunRequestInputSchema,
  RunRequestReceiptSchema,
  ExecutionArtifactSchema,
  ExecutionArtifactNameSchema,
  ExecutionInputAssetSchema,
  SaveOperationRevisionSchema,
  ExecutionJobSchema,
  ExecutionEventSchema,
  ExecutionJobResultSchema,
  ExecutionJobControlSchema,
} from "@repo/schemas";
import type { api } from "./api";
import type { McpToolRisk } from "./mcp/policy";

export type ExecutionApiClient = {
  get: typeof api.get<unknown>;
  post: typeof api.post<unknown>;
  put: typeof api.put<unknown>;
  getBytes: typeof api.getBytes;
};
const empty = z.strictObject({});
const id = z.strictObject({ id: ExecutionIdentifierSchema });
const jobId = z.strictObject({ jobId: ExecutionIdentifierSchema });
const requestId = z.strictObject({ requestId: ExecutionRequestIdSchema });
const segment = encodeURIComponent;
export const MAX_INPUT_ASSET_BYTES = 8 * 1024 * 1024;
export const ImportInputAssetSchema = z.strictObject({
  importRequestId: ExecutionRequestIdSchema,
  name: ExecutionArtifactNameSchema,
  mimeType: z.string().min(1).max(128),
  contentBase64: z
    .string()
    .max(4 * Math.ceil(MAX_INPUT_ASSET_BYTES / 3))
    .regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u)
    .refine(
      (value) => Buffer.byteLength(value, "base64") <= MAX_INPUT_ASSET_BYTES,
      "Input file exceeds 8 MiB",
    ),
});
export const ArtifactContentInputSchema = z.strictObject({
  id: ExecutionIdentifierSchema,
  offset: z.number().int().nonnegative().default(0),
  length: z
    .number()
    .int()
    .min(1)
    .max(1024 * 1024)
    .default(64 * 1024),
});

const unwrap = <T>(result: Awaited<ReturnType<typeof api.get<T>>>): T => {
  if (!result.ok)
    throw new Error(`${result.code}: ${result.status ?? "network"} ${result.message}`);

  return result.data;
};
export type ExecutionAction = {
  name: string;
  description: string;
  risk: McpToolRisk;
  inputSchema: Record<string, unknown>;
  call: (input: unknown, client: ExecutionApiClient) => Promise<unknown>;
};
const action = <S extends z.ZodType>(
  name: string,
  description: string,
  risk: McpToolRisk,
  schema: S,
  call: (input: z.output<S>, client: ExecutionApiClient) => Promise<unknown>,
): ExecutionAction => ({
  name,
  description,
  risk,
  inputSchema: z.toJSONSchema(schema, { io: "input" }),
  call: async (input, client) => call(schema.parse(input), client),
});
const read = <S extends z.ZodType>(
  name: string,
  description: string,
  schema: S,
  path: (input: z.output<S>) => string,
  output: z.ZodType,
) =>
  action(name, description, "read", schema, async (input, client) =>
    output.parse(unwrap(await client.get(path(input)))),
  );

const receiptOutput = (value: unknown) => {
  const receipt = RunRequestReceiptSchema.parse(value);

  return receipt.state === "awaiting_approval"
    ? {
        ...receipt,
        nextStep: `Ask the user to approve this request in the ORDINE App, then query ordine.v2.run_requests.get with requestId=${receipt.requestId}. After acceptance query the returned jobId. The agent must not approve its own request.`,
      }
    : receipt;
};

export const EXECUTION_ACTIONS: readonly ExecutionAction[] = [
  read(
    "readiness",
    "Read execution v2 readiness, database and capabilities.",
    empty,
    () => "/api/v2/readiness",
    ExecutionReadinessSchema,
  ),
  read(
    "operations.list",
    "List immutable v2 operation revisions.",
    empty,
    () => "/api/v2/operations",
    z.array(OperationRevisionSchema),
  ),
  action(
    "operations.save",
    "Save an operation with expectedRevision CAS (0 for a new operation).",
    "write",
    SaveOperationRevisionSchema,
    async (input, client) =>
      OperationRevisionSchema.parse(
        unwrap(await client.put(`/api/v2/operations/${segment(input.operation.id)}`, input)),
      ),
  ),
  read(
    "pipelines.list",
    "List v2 pipeline definitions.",
    empty,
    () => "/api/v2/pipelines",
    z.array(PipelineDefinitionSchema),
  ),
  read(
    "pipelines.get",
    "Read a v2 pipeline definition and revision.",
    id,
    (input) => `/api/v2/pipelines/${segment(input.id)}`,
    PipelineDefinitionSchema,
  ),
  action(
    "pipelines.save",
    "Save a v2 pipeline with expectedRevision CAS (0 for new).",
    "write",
    SavePipelineDefinitionSchema,
    async (input, client) =>
      PipelineDefinitionSchema.parse(
        unwrap(await client.put(`/api/v2/pipelines/${segment(input.pipelineId)}`, input)),
      ),
  ),
  action(
    "run_requests.submit",
    "Submit once with an explicit persistent UUID requestId. Approval is performed by the user in the App. On timeout query the SAME requestId; never create a replacement or assume execution started.",
    "execute",
    RunRequestInputSchema,
    async (input, client) => {
      const result = await client.post("/api/v2/run-requests", input);
      if (!result.ok)
        throw new Error(
          `${result.code}: ${result.message}. Recover by querying requestId=${input.requestId}; do not generate another requestId or restart.`,
        );

      return receiptOutput(result.data);
    },
  ),
  action(
    "run_requests.get",
    "Recover the receipt by original requestId. An awaiting_approval receipt requires the user in the App. A 404 does not authorize creating a new requestId.",
    "read",
    requestId,
    async (input, client) =>
      receiptOutput(unwrap(await client.get(`/api/v2/run-requests/${segment(input.requestId)}`))),
  ),
  read(
    "jobs.list",
    "List v2 jobs; a job ID or state alone does not prove delivery.",
    empty,
    () => "/api/v2/jobs",
    z.array(ExecutionJobSchema),
  ),
  read(
    "jobs.get",
    "Read a v2 job, including its persisted execution state.",
    jobId,
    (input) => `/api/v2/jobs/${segment(input.jobId)}`,
    ExecutionJobSchema,
  ),
  read(
    "jobs.events",
    "Read persisted events after a sequence cursor.",
    z.strictObject({
      ...jobId.shape,
      afterSequence: z.number().int().nonnegative().default(0),
      limit: z.number().int().min(1).max(1000).default(100),
    }),
    (input) =>
      `/api/v2/jobs/${segment(input.jobId)}/events?afterSequence=${input.afterSequence}&limit=${input.limit}`,
    z.array(ExecutionEventSchema),
  ),
  read(
    "jobs.result",
    "Read typed outputs, published artifacts and warnings; verify delivery independently of job status.",
    jobId,
    (input) => `/api/v2/jobs/${segment(input.jobId)}/result`,
    ExecutionJobResultSchema,
  ),
  read(
    "jobs.artifacts",
    "List published artifact metadata for a job.",
    jobId,
    (input) => `/api/v2/jobs/${segment(input.jobId)}/artifacts`,
    z.array(ExecutionArtifactSchema),
  ),
  action(
    "jobs.control",
    "Pause, resume or cancel a job. This cannot approve a run request.",
    "execute",
    z.strictObject({ ...jobId.shape, ...ExecutionJobControlSchema.shape }),
    async (input, client) =>
      ExecutionJobSchema.parse(
        unwrap(
          await client.post(`/api/v2/jobs/${segment(input.jobId)}/control`, {
            action: input.action,
          }),
        ),
      ),
  ),
  action(
    "jobs.checkpoint_ack",
    "Acknowledge an execution checkpoint. This is not run-request approval.",
    "execute",
    z.strictObject({ ...jobId.shape, nodeId: ExecutionIdentifierSchema }),
    async (input, client) =>
      ExecutionJobSchema.parse(
        unwrap(
          await client.post(
            `/api/v2/jobs/${segment(input.jobId)}/checkpoints/${segment(input.nodeId)}/ack`,
            {},
          ),
        ),
      ),
  ),
  read(
    "artifacts.get",
    "Read artifact or imported input asset metadata, provenance and SHA-256.",
    id,
    (input) => `/api/v2/artifacts/${segment(input.id)}`,
    z.union([ExecutionArtifactSchema, ExecutionInputAssetSchema]),
  ),
  action(
    "artifacts.content",
    "Read an explicit artifact byte range (maximum 1 MiB), returned as base64. Use metadata and SHA-256 to verify the complete file.",
    "read",
    ArtifactContentInputSchema,
    async (input, client) => {
      const bytes = unwrap(
        await client.getBytes(
          `/api/v2/artifacts/${segment(input.id)}/content?offset=${input.offset}&length=${input.length}`,
        ),
      );
      if (bytes.byteLength > input.length)
        throw new Error("API_RESPONSE_INVALID: artifact byte range exceeded requested length");

      return {
        artifactId: input.id,
        offset: input.offset,
        sizeBytes: bytes.byteLength,
        contentBase64: Buffer.from(bytes).toString("base64"),
      };
    },
  ),
  action(
    "input_assets.import",
    "Import explicit base64 file content (at most 8 MiB) with a persistent UUID importRequestId. Use the returned artifactId as a typed input; never guess paths from script output.",
    "write",
    ImportInputAssetSchema,
    async (input, client) =>
      ExecutionInputAssetSchema.parse(unwrap(await client.post("/api/v2/input-assets", input))),
  ),
];

export const findExecutionAction = (name: string) =>
  EXECUTION_ACTIONS.find((entry) => entry.name === name);
