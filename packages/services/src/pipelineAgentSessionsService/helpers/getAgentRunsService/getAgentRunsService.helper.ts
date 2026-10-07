import { createAgentRunsService } from "../../../agentRunsService";

import type { PipelineAgentSessionsServiceBindings } from "../../contracts";
export const createGetAgentRunsServiceHelper =
  (
    serviceBindings: Pick<
      PipelineAgentSessionsServiceBindings,
      "dependencies" | "agentRunsServiceState" | "db"
    >,
  ) =>
  () => {
    if (serviceBindings.dependencies.agentRunsService)
      return serviceBindings.dependencies.agentRunsService;

    serviceBindings.agentRunsServiceState.local ??= createAgentRunsService(serviceBindings.db);

    return serviceBindings.agentRunsServiceState.local;
  };
