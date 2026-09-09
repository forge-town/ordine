import { z } from "zod/v4";
import { ExecutionOverridesSchema } from "./ExecutionOptionsSchema";
import {
  EXECUTION_MAX_VALUES_PER_PORT,
  ExecutionApiVersionSchema,
  ExecutionIdentifierSchema,
  ExecutionPortIdSchema,
  ExecutionRequestIdSchema,
  ExecutionRevisionSchema,
  ExecutionTimestampSchema,
} from "./ExecutionProtocolSchema";
import { ExecutionPortValuesSchema } from "./ExecutionValueSchema";

export const ExecutionDeliveryRequirementSchema = z.strictObject({
  nodeId: ExecutionIdentifierSchema,
  portId: ExecutionPortIdSchema,
  minimumItems: z.number().int().min(1).max(EXECUTION_MAX_VALUES_PER_PORT),
});
export type ExecutionDeliveryRequirement = z.infer<typeof ExecutionDeliveryRequirementSchema>;

export const RunRequestInputSchema = z
  .strictObject({
    apiVersion: ExecutionApiVersionSchema,
    requestId: ExecutionRequestIdSchema,
    pipelineId: ExecutionIdentifierSchema,
    expectedRevision: ExecutionRevisionSchema,
    inputs: ExecutionPortValuesSchema.default({}),
    executionOverrides: ExecutionOverridesSchema.default({}),
    deliveryRequirements: z.array(ExecutionDeliveryRequirementSchema).max(64).default([]),
  })
  .superRefine((value, context) => {
    const seen = new Set<string>();
    value.deliveryRequirements.forEach((requirement, index) => {
      const key = `${requirement.nodeId}\u0000${requirement.portId}`;
      if (seen.has(key)) {
        context.addIssue({
          code: "custom",
          message: "Duplicate delivery requirement for a node and port",
          path: ["deliveryRequirements", index],
        });
      }
      seen.add(key);
    });
  });
export type RunRequestInput = z.infer<typeof RunRequestInputSchema>;

export const AgentExecutionRequestReferenceSchema = z.strictObject({
  toolName: z.enum([
    "ordine.prepare_pipeline_run",
    "ordine.prepare_operation_run",
    "ordine.prepare_routine_run",
  ]),
  requestId: ExecutionRequestIdSchema,
});

export const RunRequestStateSchema = z.enum([
  "awaiting_approval",
  "accepted",
  "rejected",
  "expired",
  "invalid",
]);
export type RunRequestState = z.infer<typeof RunRequestStateSchema>;

const identity = {
  apiVersion: ExecutionApiVersionSchema,
  requestId: ExecutionRequestIdSchema,
};
const preparedIdentity = { ...identity, preparedRunId: ExecutionIdentifierSchema };

export const RunRequestReceiptSchema = z.discriminatedUnion("state", [
  z.strictObject({
    ...preparedIdentity,
    state: z.literal("awaiting_approval"),
    approvalId: ExecutionIdentifierSchema,
    expiresAt: ExecutionTimestampSchema,
  }),
  z.strictObject({
    ...preparedIdentity,
    state: z.literal("accepted"),
    jobId: ExecutionIdentifierSchema,
    acceptedAt: ExecutionTimestampSchema,
  }),
  z.strictObject({
    ...preparedIdentity,
    state: z.literal("rejected"),
    approvalId: ExecutionIdentifierSchema,
    decidedAt: ExecutionTimestampSchema,
  }),
  z.strictObject({
    ...preparedIdentity,
    state: z.literal("expired"),
    expiredAt: ExecutionTimestampSchema,
  }),
  z.strictObject({
    ...identity,
    state: z.literal("invalid"),
    error: z.strictObject({
      code: ExecutionIdentifierSchema,
      message: z.string().min(1).max(2000),
      retryable: z.boolean(),
      field: z.string().max(200).optional(),
    }),
  }),
]);
export type RunRequestReceipt = z.infer<typeof RunRequestReceiptSchema>;
