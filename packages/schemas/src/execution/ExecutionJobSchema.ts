import { z } from "zod/v4";
import {
  ExecutionApiVersionSchema,
  ExecutionIdentifierSchema,
  ExecutionTimestampSchema,
  ExecutionRequestIdSchema,
  ExecutionRevisionSchema,
} from "./ExecutionProtocolSchema";
import { ExecutionJobStateSchema } from "./ExecutionJobStateSchema";
import { ExecutionErrorSchema, ExecutionWarningsSchema } from "./ExecutionErrorSchema";
import { ExecutionPortValuesSchema } from "./ExecutionValueSchema";
import { ExecutionArtifactSchema } from "./ExecutionArtifactSchema";
import { ExecutionJsonObjectSchema } from "./ExecutionPortDefinitionSchema";

export const ExecutionJobSchema = z.strictObject({
  apiVersion: ExecutionApiVersionSchema,
  id: ExecutionIdentifierSchema,
  preparedRunId: ExecutionIdentifierSchema,
  revision: z.number().int().nonnegative(),
  state: ExecutionJobStateSchema,
  createdAt: ExecutionTimestampSchema,
  startedAt: ExecutionTimestampSchema.nullable(),
  finishedAt: ExecutionTimestampSchema.nullable(),
  deadlineAt: ExecutionTimestampSchema.nullable(),
  waitingDeadlineAt: ExecutionTimestampSchema.nullable(),
  stopReason: z.enum(["cancelled", "timed_out"]).nullable(),
  error: ExecutionErrorSchema.nullable(),
  warnings: ExecutionWarningsSchema,
});
export type ExecutionJob = z.infer<typeof ExecutionJobSchema>;

/** Names and revisions describe the approved snapshot, never the latest authoring draft. */
export const ExecutionJobSummarySchema = ExecutionJobSchema.extend({
  pipelineId: ExecutionIdentifierSchema,
  pipelineName: z.string().min(1).max(240),
  pipelineRevision: ExecutionRevisionSchema,
  requestId: ExecutionRequestIdSchema,
});
export type ExecutionJobSummary = z.infer<typeof ExecutionJobSummarySchema>;

export const ExecutionEventSchema = z.strictObject({
  sequence: z.number().int().positive(),
  jobId: ExecutionIdentifierSchema,
  nodeId: ExecutionIdentifierSchema.nullable(),
  attemptId: ExecutionIdentifierSchema.nullable(),
  type: ExecutionIdentifierSchema,
  payload: ExecutionJsonObjectSchema,
  createdAt: ExecutionTimestampSchema,
});
export type ExecutionEvent = z.infer<typeof ExecutionEventSchema>;

export const ExecutionJobResultSchema = z.strictObject({
  jobId: ExecutionIdentifierSchema,
  state: ExecutionJobStateSchema,
  outputs: ExecutionPortValuesSchema.nullable(),
  artifacts: z.array(ExecutionArtifactSchema).max(1000),
  warnings: ExecutionWarningsSchema,
});
export type ExecutionJobResult = z.infer<typeof ExecutionJobResultSchema>;

export const ExecutionJobControlSchema = z.strictObject({
  action: z.enum(["pause", "resume", "cancel"]),
});
