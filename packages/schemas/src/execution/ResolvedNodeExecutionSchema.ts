import { z } from "zod/v4";
import { AgentRuntimeSchema } from "../agent-runtime/AgentRuntimeSchema";
import { ExecutionOverridesSchema } from "./ExecutionOptionsSchema";
import { EXECUTION_MAX_TIMEOUT_MS, ExecutionIdentifierSchema } from "./ExecutionProtocolSchema";

export const EXECUTION_TIMEOUT_DEFAULTS = Object.freeze({
  firstOutputTimeoutMs: 120_000,
  inactivityTimeoutMs: 600_000,
  activeRunTimeoutMs: 3_600_000,
  waitingTimeoutMs: 86_400_000,
});
export const ExecutionTimeoutsSchema = z.strictObject({
  firstOutputTimeoutMs: z.number().int().min(0).max(EXECUTION_MAX_TIMEOUT_MS),
  inactivityTimeoutMs: z.number().int().positive().max(EXECUTION_MAX_TIMEOUT_MS),
  activeRunTimeoutMs: z.number().int().positive().max(EXECUTION_MAX_TIMEOUT_MS),
  waitingTimeoutMs: z.number().int().positive().max(EXECUTION_MAX_TIMEOUT_MS),
});
export type ExecutionTimeouts = z.infer<typeof ExecutionTimeoutsSchema>;

export const ExecutionOptionOriginSchema = z.enum([
  "run",
  "node",
  "operation",
  "settings",
  "runtime",
  "policy",
]);
export type ExecutionOptionOrigin = z.infer<typeof ExecutionOptionOriginSchema>;

export const ResolvedNodeExecutionSchema = z
  .strictObject({
    executorKind: z.enum(["script", "agent", "builtin"]),
    runtimeConfigId: ExecutionIdentifierSchema.optional(),
    agent: AgentRuntimeSchema.optional(),
    executablePath: z.string().min(1).max(32_768).optional(),
    executableSha256: z
      .string()
      .regex(/^[a-f0-9]{64}$/u)
      .optional(),
    model: ExecutionOverridesSchema.shape.model,
    reasoningEffort: ExecutionOverridesSchema.shape.reasoningEffort,
    speed: ExecutionOverridesSchema.shape.speed,
    timeouts: ExecutionTimeoutsSchema,
    origins: z.partialRecord(ExecutionOverridesSchema.keyof(), ExecutionOptionOriginSchema),
  })
  .superRefine((value, context) => {
    const runtimeFields = ["runtimeConfigId", "agent", "model"] as const;
    if (value.executorKind === "agent") {
      for (const field of [...runtimeFields, "executablePath"] as const) {
        if (value[field] === undefined)
          context.addIssue({
            code: "custom",
            message: "Agent execution requires an explicit resolved runtime and model",
            path: [field],
          });
      }
    } else {
      for (const field of [...runtimeFields, "reasoningEffort", "speed"] as const) {
        if (value[field] !== undefined)
          context.addIssue({
            code: "custom",
            message: "Non-agent execution cannot carry an Agent runtime",
            path: [field],
          });
      }
    }
    if (
      value.executorKind === "builtin" &&
      (value.executablePath !== undefined || value.executableSha256 !== undefined)
    )
      context.addIssue({
        code: "custom",
        message: "Builtin execution cannot carry an executable",
        path: ["executablePath"],
      });
    if (
      value.executorKind === "script" &&
      (value.executablePath === undefined) !== (value.executableSha256 === undefined)
    )
      context.addIssue({
        code: "custom",
        message: "Script executable path and fingerprint must be resolved together",
        path: ["executableSha256"],
      });
  });
export type ResolvedNodeExecution = z.infer<typeof ResolvedNodeExecutionSchema>;
