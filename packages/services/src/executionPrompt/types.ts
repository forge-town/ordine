import { z } from "zod/v4";
import type { Result } from "neverthrow";
import type { ExecutionError, RuntimeEvent } from "@repo/schemas";
import type { ExecutionActorContext, ExecutionActorDependencies } from "../executionActors";

export const ExecutionPromptLimitsSchema = z.strictObject({
  maxPromptBytes: z
    .number()
    .int()
    .positive()
    .max(8 * 1024 * 1024)
    .default(1024 * 1024),
  maxStreamBytes: z
    .number()
    .int()
    .positive()
    .max(16 * 1024 * 1024)
    .default(4 * 1024 * 1024),
  maxEventBytes: z
    .number()
    .int()
    .positive()
    .max(2 * 1024 * 1024)
    .default(1024 * 1024),
  maxEvents: z.number().int().positive().max(10_000).default(1000),
  callbackTimeoutMs: z.number().int().positive().max(60_000).default(10_000),
});
export type ExecutionPromptLimits = z.infer<typeof ExecutionPromptLimitsSchema>;
export type ExecutionPromptDependencies = {
  artifactStore: ExecutionActorDependencies["artifactStore"];
  onRuntimeEvent?: (
    context: ExecutionActorContext,
    event: RuntimeEvent,
  ) => Promise<Result<void, ExecutionError>>;
  limits?: z.input<typeof ExecutionPromptLimitsSchema>;
};
