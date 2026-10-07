import type { AgentRun } from "@repo/schemas";

import type { AgentRunsServiceBindings } from "../../contracts";
export const createGetLatestByOwnerMethod = (
  serviceBindings: Pick<AgentRunsServiceBindings, "runsDao" | "getPublicRun">,
) =>
  ({
    async getLatestByOwner(ownerType: string, ownerId: string): Promise<AgentRun | null> {
      const run = await serviceBindings.runsDao.findLatestByOwner(ownerType, ownerId);

      return run ? (0, serviceBindings.getPublicRun)(run) : null;
    },
  }).getLatestByOwner;
