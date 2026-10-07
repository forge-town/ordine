import { ResultAsync } from "neverthrow";

import { logger } from "@repo/logger";

import type { NodeRunStatus } from "@repo/schemas";
import type { JobsDao } from "@repo/models";

import type { RunPipelineAssemblyBindings } from "../../contracts";
export const createRunPipelineCreateNodeStatusWriterHelper =
  (_serviceBindings: Pick<RunPipelineAssemblyBindings, never>) =>
  ({ jobsDao, jobId }: { jobsDao: JobsDao; jobId: string }) => {
    const nodeStatuses: Record<string, NodeRunStatus> = {};
    const state = {
      writeQueue: Promise.resolve(),
    };

    return (nodeId: string, status: NodeRunStatus): Promise<void> => {
      state.writeQueue = state.writeQueue.then(async () => {
        nodeStatuses[nodeId] = status;
        const updateResult = await ResultAsync.fromPromise(
          jobsDao.setNodeStatuses(jobId, { ...nodeStatuses }),
          (e) => e,
        );
        if (updateResult.isErr()) {
          logger.error(
            { err: updateResult.error, jobId, nodeId, status },
            "runPipeline: failed to update node status",
          );
        }
      });

      return state.writeQueue;
    };
  };
