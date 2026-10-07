import { RuntimeEventSchema, type AgentRuntime, type RuntimeEvent } from "@repo/schemas";

export const runtimeEvent = (
  runtime: AgentRuntime,
  payload: Record<string, unknown>,
): RuntimeEvent =>
  RuntimeEventSchema.parse({
    ...payload,
    runtime,
    timestamp: new Date().toISOString(),
  });
