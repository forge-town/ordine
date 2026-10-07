import { TERMINAL_AGENT_RUN_STATUSES, type AgentRun } from "@repo/schemas";

import type { AgentRunsServiceBindings } from "../../contracts";
export const createWaitMethod = (
  serviceBindings: Pick<AgentRunsServiceBindings, "executions" | "getRunRecord" | "getPublicRun">,
) =>
  ({
    async wait(runId: string): Promise<AgentRun> {
      const execution = serviceBindings.executions.get(runId);
      if (execution) return execution;
      const run = await (0, serviceBindings.getRunRecord)(runId);
      if (TERMINAL_AGENT_RUN_STATUSES.has(run.status))
        return (0, serviceBindings.getPublicRun)(run);

      throw new Error(`Agent run ${runId} is not executing in this service process`);
    },
  }).wait;
