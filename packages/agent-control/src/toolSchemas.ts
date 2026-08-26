import { z } from "zod/v4";
import {
  AgentApprovalSchema,
  AgentContextEnvelopeSchema,
  AgentControlToolResultSchema,
  AgentResourceTypeSchema,
  JobStatusSchema,
  PipelineGraphNodeSchema,
} from "@repo/schemas";

const MAX_PATCH_BYTES = 32 * 1024;
const SECRET_KEY =
  /(?:api[-_]?key|authorization|bearer|credential|password|private[-_]?key|secret|token)/i;

const collectSecretPaths = (value: unknown, prefix = ""): string[] => {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectSecretPaths(item, `${prefix}[${index}]`));
  }

  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;

    return [...(SECRET_KEY.test(key) ? [path] : []), ...collectSecretPaths(child, path)];
  });
};

export const CompactPatchSchema = z
  .record(z.string(), z.unknown())
  .superRefine((value, context) => {
    const bytes = new TextEncoder().encode(JSON.stringify(value)).byteLength;
    if (bytes > MAX_PATCH_BYTES) {
      context.addIssue({
        code: "custom",
        message: `patch exceeds ${MAX_PATCH_BYTES} bytes`,
      });
    }
    for (const path of collectSecretPaths(value)) {
      context.addIssue({
        code: "custom",
        message: "secret values are not accepted by Agent Control tools",
        path: path.split("."),
      });
    }
  });

const CallMetadataSchema = z.object({
  callId: z.string().min(1).max(200),
  approvalRequestId: z.string().min(1).optional(),
});

const ChangeSetMetadataSchema = CallMetadataSchema.extend({
  threadId: z.string().min(1),
  runId: z.string().min(1).optional(),
  changeSetId: z.string().min(1).optional(),
});

export const SearchResourcesInputSchema = z
  .object({
    query: z.string().min(1).max(500),
    resourceTypes: z.array(AgentResourceTypeSchema).max(10).optional(),
    cursor: z.string().min(1).optional(),
    limit: z.number().int().min(1).max(50).default(20),
  })
  .strict();

export const GetResourceInputSchema = z
  .object({
    resourceType: AgentResourceTypeSchema,
    id: z.string().min(1),
  })
  .strict();

export const DescribeResourceInputSchema = z
  .object({ resourceType: AgentResourceTypeSchema })
  .strict();

export const CreateResourceInputSchema = CallMetadataSchema.extend({
  resourceType: AgentResourceTypeSchema.exclude(["job"]),
  data: CompactPatchSchema,
}).strict();

export const UpdateResourceInputSchema = CallMetadataSchema.extend({
  resourceType: AgentResourceTypeSchema.exclude(["job"]),
  id: z.string().min(1),
  patch: CompactPatchSchema,
  expectedVersion: z.number().int().positive().optional(),
}).strict();

export const ArchiveResourceInputSchema = CallMetadataSchema.extend({
  resourceType: AgentResourceTypeSchema.extract(["pipeline", "routine"]),
  id: z.string().min(1),
  expectedVersion: z.number().int().positive().optional(),
}).strict();

export const DeleteResourceInputSchema = CallMetadataSchema.extend({
  resourceType: AgentResourceTypeSchema.exclude(["job"]),
  id: z.string().min(1),
  expectedVersion: z.number().int().positive().optional(),
}).strict();

export const InspectCanvasInputSchema = z
  .object({
    pipelineId: z.string().min(1),
    nodeIds: z.array(z.string().min(1)).max(100).optional(),
    cursor: z.string().min(1).optional(),
    limit: z.number().int().min(1).max(100).default(50),
  })
  .strict();

export const AddNodeInputSchema = ChangeSetMetadataSchema.extend({
  pipelineId: z.string().min(1),
  node: PipelineGraphNodeSchema,
}).strict();

export const UpdateNodeInputSchema = ChangeSetMetadataSchema.extend({
  pipelineId: z.string().min(1),
  nodeId: z.string().min(1),
  patch: CompactPatchSchema,
}).strict();

export const RemoveNodeInputSchema = ChangeSetMetadataSchema.extend({
  pipelineId: z.string().min(1),
  nodeId: z.string().min(1),
}).strict();

export const ConnectNodesInputSchema = ChangeSetMetadataSchema.extend({
  pipelineId: z.string().min(1),
  edgeId: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  sourceHandle: z.string().nullable().optional(),
  targetHandle: z.string().nullable().optional(),
}).strict();

export const DisconnectEdgeInputSchema = ChangeSetMetadataSchema.extend({
  pipelineId: z.string().min(1),
  edgeId: z.string().min(1),
}).strict();

export const ReconnectEdgeInputSchema = ConnectNodesInputSchema.omit({ edgeId: true })
  .extend({
    edgeId: z.string().min(1),
  })
  .strict();

export const ValidateCanvasInputSchema = z
  .object({
    pipelineId: z.string().min(1),
    threadId: z.string().min(1),
    changeSetId: z.string().min(1).optional(),
  })
  .strict();

export const FinishCanvasEditInputSchema = ChangeSetMetadataSchema.extend({
  pipelineId: z.string().min(1),
  expectedVersion: z.number().int().positive(),
}).strict();

export const RunPipelineInputSchema = CallMetadataSchema.extend({
  pipelineId: z.string().min(1),
  input: CompactPatchSchema.optional(),
}).strict();

export const RunOperationInputSchema = CallMetadataSchema.extend({
  operationId: z.string().min(1),
  input: CompactPatchSchema.optional(),
}).strict();

export const RunRoutineInputSchema = CallMetadataSchema.extend({
  routineId: z.string().min(1),
}).strict();

export const ControlJobInputSchema = CallMetadataSchema.extend({
  jobId: z.string().min(1),
  action: z.enum(["pause", "resume", "cancel"]),
}).strict();

export const GetJobTraceInputSchema = z
  .object({
    jobId: z.string().min(1),
    status: JobStatusSchema.optional(),
    cursor: z.string().min(1).optional(),
    limit: z.number().int().min(1).max(100).default(50),
  })
  .strict();

export const TestConnectorInputSchema = CallMetadataSchema.extend({
  connectorId: z.string().min(1),
}).strict();

export const AgentControlToolOutputSchema = AgentControlToolResultSchema;
export const AgentControlContextInputSchema = AgentContextEnvelopeSchema;
export const AgentControlApprovalOutputSchema = AgentApprovalSchema;
