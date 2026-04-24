import { AgentRuntimeSchema } from "@repo/schemas";

const DEFAULT_AGENT_RUNTIME = "mastra";

export const normalizeSettingsRecord = <T extends { defaultAgentRuntime: unknown }>(
  record: T
): Omit<T, "defaultAgentRuntime"> & {
  defaultAgentRuntime: (typeof AgentRuntimeSchema.options)[number];
} => {
  const parsedAgentRuntime = AgentRuntimeSchema.safeParse(record.defaultAgentRuntime);

  return {
    ...record,
    defaultAgentRuntime: parsedAgentRuntime.success
      ? parsedAgentRuntime.data
      : DEFAULT_AGENT_RUNTIME,
  };
};
