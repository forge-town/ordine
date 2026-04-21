import { ResultAsync } from "neverthrow";
import { trace } from "@repo/obs";
import { logger } from "@repo/logger";
import {
  pipelineEngine,
  ScriptExecutionError,
  type PipelineEngineDeps,
  type PipelineRunError,
  type OperationInfo,
} from "@repo/pipeline-engine";
import type {
  OperationsDao,
  PipelinesDao,
  JobsDao,
  SkillsDao,
  BestPracticesDao,
} from "@repo/models";

/**
 * Mark a job as failed. Swallows any DAO/trace errors to guarantee the caller
 * never sees an unhandled rejection from this helper.
 */
const failJobSafely = async ({
  jobsDao,
  jobId,
  message,
}: {
  jobsDao: JobsDao;
  jobId: string;
  message: string;
}): Promise<void> => {
  const safeTrace = await ResultAsync.fromPromise(
    trace(jobId, `ERROR: ${message}`, "error"),
    (e) => e,
  );
  if (safeTrace.isErr()) {
    logger.error(
      { err: safeTrace.error, jobId },
      "runPipeline: trace failed during error handling",
    );
  }

  const safeUpdate = await ResultAsync.fromPromise(
    jobsDao.updateStatus(jobId, "failed", {
      finishedAt: new Date(),
      error: message,
    }),
    (e) => e,
  );
  if (safeUpdate.isErr()) {
    logger.error(
      { err: safeUpdate.error, jobId },
      "runPipeline: CRITICAL — could not mark job as failed",
    );
  }
};

const run = async (opts: {
  pipelineId: string;
  inputPath?: string;
  jobId: string;
  githubToken?: string;
  pipelinesDao: PipelinesDao;
  operationsDao: OperationsDao;
  jobsDao: JobsDao;
  skillsDao: SkillsDao;
  bestPracticesDao: BestPracticesDao;
  engineDeps: PipelineEngineDeps;
}): Promise<void> => {
  const {
    pipelineId,
    jobId,
    githubToken,
    pipelinesDao,
    operationsDao,
    jobsDao,
    skillsDao,
    bestPracticesDao,
    engineDeps,
  } = opts;

  const runResult = await ResultAsync.fromPromise(
    (async () => {
      await jobsDao.updateStatus(jobId, "running", { startedAt: new Date() });
      await trace(jobId, `Starting pipeline ${pipelineId}`);

      const pipeline = await pipelinesDao.findById(pipelineId);
      if (!pipeline) {
        await failJobSafely({ jobsDao, jobId, message: `Pipeline ${pipelineId} not found` });

        return;
      }

      const operationIds = pipeline.nodes
        .filter((n) => n.type === "operation")
        .map((n) => (n.data as unknown as { operationId?: string }).operationId)
        .filter((id): id is string => id !== undefined && id !== "");

      const operationsMap = new Map<string, OperationInfo>();
      for (const id of operationIds) {
        const op = await operationsDao.findById(id);
        if (op) operationsMap.set(id, { id: op.id, name: op.name, config: op.config });
      }

      const lookupSkill = async (skillId: string) => {
        const skill = (await skillsDao.findById(skillId)) ?? (await skillsDao.findByName(skillId));

        return skill ? { id: skill.id, label: skill.label, description: skill.description } : null;
      };

      const lookupBestPractice = async (bpId: string) => {
        const bp = await bestPracticesDao.findById(bpId);

        return bp ? { title: bp.title, content: bp.content } : null;
      };

      const result = await ResultAsync.fromPromise(
        pipelineEngine.execute({
          pipeline: {
            id: pipeline.id,
            name: pipeline.name,
            nodes: pipeline.nodes,
            edges: pipeline.edges,
          },
          jobId,
          inputPath: opts.inputPath,
          githubToken,
          operations: operationsMap,
          deps: engineDeps,
          lookupSkill,
          lookupBestPractice,
        }),
        (cause) =>
          new ScriptExecutionError(
            cause instanceof Error ? cause.message : String(cause),
            cause,
          ) as PipelineRunError,
      );

      const outcome = result.isOk() ? result.value : { ok: false as const, error: result.error };

      if (outcome.ok) {
        await jobsDao.updateStatus(jobId, "done", {
          finishedAt: new Date(),
          result: { summary: outcome.summary },
        });
      } else {
        await failJobSafely({ jobsDao, jobId, message: outcome.error.message });
      }
    })(),
    (cause) => (cause instanceof Error ? cause : new Error(String(cause))),
  );

  if (runResult.isErr()) {
    logger.error({ err: runResult.error, jobId }, "runPipeline: unhandled error in pipeline run");
    await failJobSafely({
      jobsDao,
      jobId,
      message: `Unhandled error: ${runResult.error.message}`,
    });
  }
};

export const pipelineRunExecutor = {
  run,
};
