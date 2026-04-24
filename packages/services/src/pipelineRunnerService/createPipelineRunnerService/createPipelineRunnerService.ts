import { ok, err, ResultAsync, type Result } from "neverthrow";
import { initObs, initSpanRecorder } from "@repo/obs";
import { logger } from "@repo/logger";
import type { AgentRuntime } from "@repo/schemas";
import { loopEvaluator } from "../loopEvaluator";
import { pipelineRunnerEngineDeps } from "../engineDeps";
import { pipelineRunExecutor } from "../runPipeline";
import {
  createOperationsDao,
  createPipelinesDao,
  createJobsDao,
  createJobTracesDao,
  createSkillsDao,
  createBestPracticesDao,
  createAgentRawExportsDao,
  createAgentSpansDao,
  createSettingsDao,
  type DbConnection,
} from "@repo/models";

export class PipelineNotFoundError extends Error {
  constructor(pipelineId: string) {
    super(`Pipeline ${pipelineId} not found`);
    this.name = "PipelineNotFoundError";
  }
}

export const createPipelineRunnerService = (db: DbConnection) => {
  const operationsDao = createOperationsDao(db);
  const pipelinesDao = createPipelinesDao(db);
  const jobsDao = createJobsDao(db);
  const jobTracesDao = createJobTracesDao(db);
  const skillsDao = createSkillsDao(db);
  const bestPracticesDao = createBestPracticesDao(db);
  const agentRawExportsDao = createAgentRawExportsDao(db);
  const agentSpansDao = createAgentSpansDao(db);
  const settingsDao = createSettingsDao(db);

  initObs(jobTracesDao);
  initSpanRecorder({ agentRawExportsDao, agentSpansDao });

  const loopEvaluatorFactory = loopEvaluator.create();

  const buildDepsForJob = ({
    jobId,
    apiKey,
    model,
    defaultAgent,
  }: {
    jobId: string;
    apiKey?: string;
    model?: string;
    defaultAgent?: AgentRuntime;
  }) =>
    pipelineRunnerEngineDeps.build({
      evaluateLoopCondition: loopEvaluatorFactory({ jobId }),
      jobId,
      apiKey,
      model,
      defaultAgent,
    });

  return {
    startRun: async (opts: {
      pipelineId: string;
      inputPath?: string;
      githubToken?: string;
    }): Promise<Result<{ jobId: string }, PipelineNotFoundError>> => {
      const pipeline = await pipelinesDao.findById(opts.pipelineId);
      if (!pipeline) {
        return err(new PipelineNotFoundError(opts.pipelineId));
      }

      const jobId = crypto.randomUUID();
      await jobsDao.create({
        id: jobId,
        title: `Run: ${pipeline.name}`,
        type: "pipeline_run",
        pipelineId: opts.pipelineId,
        projectId: null,
        logs: [],
        result: null,
        error: null,
        status: "queued",
        startedAt: null,
        finishedAt: null,
      });

      const settings = await settingsDao.get();

      void ResultAsync.fromPromise(
        pipelineRunExecutor.run({
          pipelineId: opts.pipelineId,
          inputPath: opts.inputPath,
          githubToken: opts.githubToken,
          defaultOutputPath: settings.defaultOutputPath,
          jobId,
          pipelinesDao,
          operationsDao,
          jobsDao,
          skillsDao,
          bestPracticesDao,
          engineDeps: buildDepsForJob({
            jobId,
            apiKey: settings.defaultApiKey,
            model: settings.defaultModel,
            defaultAgent: settings.defaultAgentRuntime,
          }),
        }),
        (error) => error,
      ).match(
        () => undefined,
        (error) => {
          logger.error(
            { err: error, jobId },
            "startRun: unhandled rejection from background pipeline run",
          );
        },
      );

      return ok({ jobId });
    },
  };
};
