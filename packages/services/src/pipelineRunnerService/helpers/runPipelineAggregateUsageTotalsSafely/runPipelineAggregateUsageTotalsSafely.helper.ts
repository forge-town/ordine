import { ResultAsync } from "neverthrow";

import { logger } from "@repo/logger";

import type { AgentRawExportsDao } from "@repo/models";

import type { RunPipelineAssemblyBindings } from "../../contracts";
export const createRunPipelineAggregateUsageTotalsSafelyHelper =
  (_serviceBindings: Pick<RunPipelineAssemblyBindings, never>) =>
  async ({
    agentRawExportsDao,
    jobId,
  }: {
    agentRawExportsDao: AgentRawExportsDao;
    jobId: string;
  }): Promise<{ totalTokens: number } | undefined> => {
    const rows = await ResultAsync.fromPromise(
      agentRawExportsDao.findByJobId(jobId),
      (cause) => cause,
    );
    if (rows.isErr()) {
      logger.warn({ err: rows.error, jobId }, "runPipeline: failed to aggregate usage totals");

      return undefined;
    }

    const totalTokens = rows.value.reduce(
      (sum, row) => sum + (row.tokenInput ?? 0) + (row.tokenOutput ?? 0),
      0,
    );

    return { totalTokens };
  };
