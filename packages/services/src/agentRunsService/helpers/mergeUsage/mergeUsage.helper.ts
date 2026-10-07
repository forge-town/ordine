import type { AgentRunUsage, RuntimeEvent } from "@repo/schemas";

export const mergeUsage = (
  current: AgentRunUsage | null,
  event: RuntimeEvent,
): AgentRunUsage | null => {
  if (event.type !== "usage") return current;

  return {
    ...current,
    ...(event.inputTokens === undefined ? {} : { inputTokens: event.inputTokens }),
    ...(event.outputTokens === undefined ? {} : { outputTokens: event.outputTokens }),
    ...(event.cachedInputTokens === undefined
      ? {}
      : { cachedInputTokens: event.cachedInputTokens }),
    ...(event.costUsd === undefined ? {} : { costUsd: event.costUsd }),
  };
};
