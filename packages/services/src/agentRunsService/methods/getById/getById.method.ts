import type { AgentRun } from "@repo/schemas";

import type { AgentRunsServiceBindings } from "../../contracts";
export const createGetByIdMethod = (
  serviceBindings: Pick<AgentRunsServiceBindings, "runsDao" | "getPublicRun">,
) =>
  ({
    async getById(runId: string): Promise<AgentRun | null> {
      const run = await serviceBindings.runsDao.findById(runId);

      return run ? (0, serviceBindings.getPublicRun)(run) : null;
    },
  }).getById;
