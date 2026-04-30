import { ok, err, ResultAsync, type Result } from "neverthrow";
import { initObs, initSpanRecorder } from "@repo/obs";
import { logger } from "@repo/logger";
import type { AgentRuntime, SshConnection } from "@repo/schemas";
import { loopEvaluator } from "../loopEvaluator";
import { pipelineRunnerEngineDeps } from "../engineDeps";
import { pipelineRunExecutor } from "../runPipeline";
import { normalizeSettingsRecord } from "../../settingsService/normalizeSettingsRecord";
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
  createPipelineRunsDao,
  createAgentRuntimesDao,
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
  const pipelineRunsDao = createPipelineRunsDao(db);
  const jobTracesDao = createJobTracesDao(db);
  const skillsDao = createSkillsDao(db);
  const bestPracticesDao = createBestPracticesDao(db);
  const agentRawExportsDao = createAgentRawExportsDao(db);
  const agentSpansDao = createAgentSpansDao(db);
  const settingsDao = createSettingsDao(db);
  const agentRuntimesDao = createAgentRuntimesDao(db);

  initObs(jobTracesDao);
  initSpanRecorder({ agentRawExportsDao, agentSpansDao });

  const loopEvaluatorFactory = loopEvaluator.create();

  const buildDepsForJob = ({
    jobId,
    apiKey,
    model,
    defaultAgent,
    ssh,
  }: {
    jobId: string;
    apiKey?: string;
    model?: string;
    defaultAgent?: AgentRuntime;
    ssh?: SshConnection;
  }) =>
    pipelineRunnerEngineDeps.build({
      evaluateLoopCondition: loopEvaluatorFactory({ jobId }),
      jobId,
      apiKey,
      model,
      defaultAgent,
      ssh,
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
        error: null,
        status: "queued",
        startedAt: null,
        finishedAt: null,
      });

      await pipelineRunsDao.create({
        id: jobId,
        pipelineId: opts.pipelineId,
        projectId: null,
        inputPath: opts.inputPath ?? null,
        logs: [],
        result: null,
      });

      const settings = normalizeSettingsRecord(await settingsDao.get());

      // Resolve SSH connection from agent runtimes config
      const allRuntimes = await agentRuntimesDao.findMany();
      const runtimeConfig = allRuntimes.find(
        (r) => r.type === settings.defaultAgentRuntime && r.connection.mode === "ssh",
      );
      const ssh = runtimeConfig?.connection.mode === "ssh" ? runtimeConfig.connection : undefined;

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
          pipelineRunsDao,
          skillsDao,
          bestPracticesDao,
          engineDeps: buildDepsForJob({
            jobId,
            apiKey: settings.defaultApiKey,
            model: settings.defaultModel,
            defaultAgent: settings.defaultAgentRuntime,
            ssh,
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
