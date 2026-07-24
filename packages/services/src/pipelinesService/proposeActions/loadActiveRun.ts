import type { createJobsDao, createJobTracesDao } from "@repo/models";
import { logger } from "@repo/logger";
import type { AgentContextRunState } from "@repo/schemas";
import type { ProposeActiveRun } from "./buildProposePrompt";

const MAX_ACTIVE_RUN_TRACES = 30;

export type LoadActiveRunDeps = {
  jobsDao: ReturnType<typeof createJobsDao>;
  jobTracesDao: ReturnType<typeof createJobTracesDao>;
};

/**
 * When the message carries a runState, load the job plus its most recent
 * traces. Returns undefined when the job does not exist, no runState was
 * provided, or the job belongs to a different pipeline — in those cases the
 * prompt neither injects nor claims any run context.
 */
export const loadActiveRun = async (
  deps: LoadActiveRunDeps,
  runState: AgentContextRunState | undefined,
  pipelineId: string | undefined,
): Promise<ProposeActiveRun | undefined> => {
  if (!runState) {
    return undefined;
  }

  const job = await deps.jobsDao.findById(runState.jobId);
  if (!job) {
    logger.warn({ jobId: runState.jobId }, "proposeActions: runState job not found");

    return undefined;
  }

  if (job.pipelineId !== pipelineId) {
    logger.warn(
      { jobId: runState.jobId, jobPipelineId: job.pipelineId, pipelineId },
      "proposeActions: runState job does not belong to current pipeline",
    );

    return undefined;
  }

  const traces = await deps.jobTracesDao.findByJobId(runState.jobId);

  return {
    jobId: job.id,
    jobStatus: job.status,
    nodeStatuses: runState.nodeStatuses,
    // findByJobId returns newest first; slice, then reverse to oldest-first
    // so the prompt reads chronologically.
    traces: traces
      .slice(0, MAX_ACTIVE_RUN_TRACES)
      .reverse()
      .map((trace) => ({ level: trace.level, message: trace.message })),
  };
};
