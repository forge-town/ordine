import type { createJobsDao } from "@repo/models";
import type { SkippedJobInput } from "../../contracts";
export const createRecordSkippedJobHelper =
  (jobsDao: ReturnType<typeof createJobsDao>) =>
  ({ pipelineId, routineName, reason }: SkippedJobInput) =>
    jobsDao.create({
      id: crypto.randomUUID(),
      title: `Routine skipped: ${routineName}`,
      type: "pipeline_run",
      status: "skipped",
      triggeredBy: "routine",
      pipelineId,
      parentJobId: null,
      error: reason,
      startedAt: null,
      finishedAt: new Date(),
    });
