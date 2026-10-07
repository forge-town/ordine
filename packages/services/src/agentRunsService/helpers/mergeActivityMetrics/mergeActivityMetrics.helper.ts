import { AgentRunActivityMetricsSchema, type AgentRunActivityMetrics } from "@repo/schemas";

import type { ActivityMetricsDelta } from "../../contracts";

export const mergeActivityMetrics = (
  current: AgentRunActivityMetrics | null | undefined,
  delta: ActivityMetricsDelta,
): AgentRunActivityMetrics => {
  const next = AgentRunActivityMetricsSchema.parse(current ?? {});
  for (const [key, value] of Object.entries(delta) as [keyof AgentRunActivityMetrics, number][]) {
    if (!value) continue;
    next[key] += value;
  }

  return AgentRunActivityMetricsSchema.parse(next);
};
