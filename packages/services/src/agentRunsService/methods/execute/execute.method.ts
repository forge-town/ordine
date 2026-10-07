import { TERMINAL_AGENT_RUN_STATUSES, type AgentRun, type AgentRunRequest } from "@repo/schemas";

import type { AgentRunsServiceBindings } from "../../contracts";
export const createExecuteMethod = (
  serviceBindings: Pick<
    AgentRunsServiceBindings,
    "startInternal" | "executions" | "getRunRecord" | "getPublicRun"
  >,
) =>
  ({
    async execute(request: AgentRunRequest): Promise<AgentRun> {
      const { runId } = await (0, serviceBindings.startInternal)(request);
      const execution = serviceBindings.executions.get(runId);
      if (!execution) {
        const run = await (0, serviceBindings.getRunRecord)(runId);
        if (TERMINAL_AGENT_RUN_STATUSES.has(run.status))
          return (0, serviceBindings.getPublicRun)(run);
        throw new Error(`Agent run execution was not registered: ${runId}`);
      }

      return execution;
    },
  }).execute;
