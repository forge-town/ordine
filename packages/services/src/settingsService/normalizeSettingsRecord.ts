import { DefaultAgentRuntimeSchema } from "@repo/schemas";

const DEFAULT_AGENT_RUNTIME = "mastra";

export const normalizeSettingsRecord = <
  T extends { defaultAgentRuntime: unknown },
>(
  record: T,
): Omit<T, "defaultAgentRuntime"> & {
  defaultAgentRuntime: (typeof DefaultAgentRuntimeSchema.options)[number];
} => {
  const parsedAgentRuntime = DefaultAgentRuntimeSchema.safeParse(
    record.defaultAgentRuntime,
  );

  return {
    ...record,
    defaultAgentRuntime: parsedAgentRuntime.success
      ? parsedAgentRuntime.data
      : DEFAULT_AGENT_RUNTIME,
  };
};
