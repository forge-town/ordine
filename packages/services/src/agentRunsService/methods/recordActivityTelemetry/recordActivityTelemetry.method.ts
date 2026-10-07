import {
  AgentRunActivityTelemetrySchema,
  type AgentRun,
  type AgentRunActivityTelemetry,
} from "@repo/schemas";

import { mergeActivityMetrics } from "../../helpers/mergeActivityMetrics";

import type { AgentRunsServiceBindings } from "../../contracts";
export const createRecordActivityTelemetryMethod = (
  serviceBindings: Pick<AgentRunsServiceBindings, "getRunRecord" | "runsDao" | "getPublicRun">,
) =>
  ({
    async recordActivityTelemetry(
      runId: string,
      input: AgentRunActivityTelemetry,
    ): Promise<AgentRun> {
      const telemetry = AgentRunActivityTelemetrySchema.parse(input);
      const run = await (0, serviceBindings.getRunRecord)(runId);
      const metrics = mergeActivityMetrics(
        run.activityMetrics,
        telemetry.kind === "artifact_open_failed" ? { artifactOpenFailureCount: 1 } : {},
      );
      const updated = await serviceBindings.runsDao.update(runId, { activityMetrics: metrics });

      return (0, serviceBindings.getPublicRun)(updated ?? { ...run, activityMetrics: metrics });
    },
  }).recordActivityTelemetry;
