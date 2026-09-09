import { z } from "zod/v4";
import { EXECUTION_MAX_TIMEOUT_MS, ExecutionIdentifierSchema } from "./ExecutionProtocolSchema";

const RuntimeOptionSchema = z
  .string()
  .min(1)
  .max(200)
  .refine((value) => value === value.trim() && !/\p{Cc}/u.test(value), {
    message: "Runtime options must be non-empty tokens without surrounding whitespace",
  });
const PositiveTimeoutSchema = z.number().int().min(1).max(EXECUTION_MAX_TIMEOUT_MS);

/** No defaults here: omission must remain distinct from a caller's explicit override. */
export const ExecutionOverridesSchema = z.strictObject({
  runtimeConfigId: ExecutionIdentifierSchema.optional(),
  model: RuntimeOptionSchema.optional(),
  reasoningEffort: RuntimeOptionSchema.optional(),
  speed: RuntimeOptionSchema.optional(),
  firstOutputTimeoutMs: z.number().int().min(0).max(EXECUTION_MAX_TIMEOUT_MS).optional(),
  inactivityTimeoutMs: PositiveTimeoutSchema.optional(),
  activeRunTimeoutMs: PositiveTimeoutSchema.optional(),
  waitingTimeoutMs: PositiveTimeoutSchema.optional(),
});
export type ExecutionOverrides = z.infer<typeof ExecutionOverridesSchema>;

/** Job deadlines cannot be changed by an individual node or a shared Operation. */
export const NodeExecutionOverridesSchema = ExecutionOverridesSchema.omit({
  activeRunTimeoutMs: true,
  waitingTimeoutMs: true,
});
export type NodeExecutionOverrides = z.infer<typeof NodeExecutionOverridesSchema>;
