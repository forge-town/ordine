import { TERMINAL_AGENT_RUN_STATUSES, type AgentRun } from "@repo/schemas";

import type { AgentRunsServiceBindings } from "../../contracts";
export const createCancelMethod = (
  serviceBindings: Pick<
    AgentRunsServiceBindings,
    "getRunRecord" | "getPublicRun" | "runsDao" | "activeRuns"
  >,
) =>
  ({
    async cancel(runId: string): Promise<AgentRun> {
      const run = await (0, serviceBindings.getRunRecord)(runId);
      if (TERMINAL_AGENT_RUN_STATUSES.has(run.status))
        return (0, serviceBindings.getPublicRun)(run);
      const requested = await serviceBindings.runsDao.requestCancel(runId, new Date());
      const active = serviceBindings.activeRuns.get(runId);
      if (active && !active.controller.signal.aborted) {
        active.abortReason = "user_cancel";
        active.controller.abort();
        const release = active.dispose;
        active.dispose = undefined;
        await Promise.resolve(release?.());
      }
      const updated = requested ?? (await serviceBindings.runsDao.findById(runId));

      return (0, serviceBindings.getPublicRun)(updated ?? run);
    },
  }).cancel;
