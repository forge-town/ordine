import type { AgentRunsServiceBindings } from "../../contracts";
export const createDeleteExpiredMethod = (
  serviceBindings: Pick<AgentRunsServiceBindings, "runsDao">,
) =>
  ({
    async deleteExpired(before = new Date()): Promise<number> {
      const deleted = await serviceBindings.runsDao.deleteExpired(before);

      return deleted.length;
    },
  }).deleteExpired;
