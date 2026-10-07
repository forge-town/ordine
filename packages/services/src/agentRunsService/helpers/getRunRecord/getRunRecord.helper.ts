import type { AgentRunRecord } from "@repo/db-schema";

import type { AgentRunsServiceBindings } from "../../contracts";
export const createGetRunRecordHelper =
  (serviceBindings: Pick<AgentRunsServiceBindings, "runsDao">) =>
  async (runId: string): Promise<AgentRunRecord> => {
    const run = await serviceBindings.runsDao.findById(runId);
    if (!run) throw new Error(`Agent run not found: ${runId}`);

    return run;
  };
