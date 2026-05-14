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
  AgentsDao,
  OperationsDao,
  PipelinesDao,
  JobsDao,
  PipelineRunsDao,
  SkillsDao,
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

export const pipelineRunExecutor = {
  run: async (opts: {
    pipelineId: string;
    inputPath?: string;
    inputs?: Record<string, string>;
    jobId: string;
    githubToken?: string;
    defaultOutputPath?: string;
    pipelinesDao: PipelinesDao;
    operationsDao: OperationsDao;
    agentsDao: AgentsDao;
    jobsDao: JobsDao;
    pipelineRunsDao: PipelineRunsDao;
    skillsDao: SkillsDao;
    engineDeps: PipelineEngineDeps;
  }): Promise<void> => {
    const {
      pipelineId,
      jobId,
      githubToken,
      pipelinesDao,
      operationsDao,
      agentsDao,
      jobsDao,
      pipelineRunsDao,
      skillsDao,
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
          .map((n) => (n.data.nodeType === "operation" ? n.data.operationId : undefined))
          .filter((id): id is string => id !== undefined && id !== "");

        const operationsMap = new Map<string, OperationInfo>();
        for (const id of operationIds) {
          const op = await operationsDao.findById(id);
          if (op) operationsMap.set(id, { id: op.id, name: op.name, config: op.config });
        }

        const lookupSkill = async (skillId: string) => {
          const skill =
            (await skillsDao.findById(skillId)) ?? (await skillsDao.findByName(skillId));

          return skill
            ? { id: skill.id, label: skill.label, description: skill.description }
            : null;
        };

        const lookupAgent = async (agentId: string) => {
          const agent = await agentsDao.findById(agentId);

          return agent
            ? { id: agent.id, name: agent.name, defaultRuntime: agent.defaultRuntime }
            : null;
        };

        // Inject dynamic inputs into prompt nodes before execution
        const nodes = pipeline.nodes.map((n) => {
          if (opts.inputs && n.data.nodeType === "prompt" && opts.inputs[n.id]) {
            return { ...n, data: { ...n.data, prompt: opts.inputs[n.id]! } };
          }

          return n;
        });

        const result = await ResultAsync.fromPromise(
          pipelineEngine.execute({
            pipeline: {
              id: pipeline.id,
              name: pipeline.name,
              nodes,
              edges: pipeline.edges,
            },
            jobId,
            inputPath: opts.inputPath,
            githubToken,
            defaultOutputPath: opts.defaultOutputPath,
            operations: operationsMap,
            deps: engineDeps,
            lookupAgent,
            lookupSkill,
          }),
          (cause): PipelineRunError =>
            new ScriptExecutionError(cause instanceof Error ? cause.message : String(cause), cause),
        );

        const outcome = result.isOk() ? result.value : { ok: false as const, error: result.error };

        if (outcome.ok) {
          await pipelineRunsDao.update(jobId, { result: { summary: outcome.summary } });
          await jobsDao.updateStatus(jobId, "done", {
            finishedAt: new Date(),
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
  },
};
