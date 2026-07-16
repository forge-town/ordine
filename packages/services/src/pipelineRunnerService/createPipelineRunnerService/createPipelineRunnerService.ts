import { ok, err, ResultAsync, type Result } from "neverthrow";
import { initObs, initSpanRecorder } from "@repo/obs";
import { logger } from "@repo/logger";
import type { AgentRuntime, JobTriggeredBy, SshConnection } from "@repo/schemas";
import { loopEvaluator } from "../loopEvaluator";
import { pipelineRunnerEngineDeps } from "../engineDeps";
import { pipelineRunExecutor } from "../runPipeline";
import { pipelineRunControl } from "../runControl";
import { normalizeSettingsRecord } from "../../settingsService/normalizeSettingsRecord";
import {
  createAgentsDao,
  createOperationsDao,
  createPipelinesDao,
  createJobsDao,
  createJobTracesDao,
  createSkillsDao,
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
  const agentsDao = createAgentsDao(db);
  const operationsDao = createOperationsDao(db);
  const pipelinesDao = createPipelinesDao(db);
  const jobsDao = createJobsDao(db);
  const pipelineRunsDao = createPipelineRunsDao(db);
  const jobTracesDao = createJobTracesDao(db);
  const skillsDao = createSkillsDao(db);
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
      inputs?: Record<string, string>;
      /** Per-device autonomy preference sent with the request (0 = no self-heal retries). */
      selfHealRetries?: number;
      triggeredBy?: JobTriggeredBy;
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
        pipelineId: pipeline.id,
        projectId: pipeline.projectId ?? null,
        status: "queued",
        startedAt: null,
        finishedAt: null,
        triggeredBy: opts.triggeredBy ?? "manual",
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
          inputs: opts.inputs,
          defaultOutputPath: settings.defaultOutputPath,
          selfHealRetries: opts.selfHealRetries,
          jobId,
          pipelinesDao,
          operationsDao,
          agentsDao,
          jobsDao,
          pipelineRunsDao,
          skillsDao,
          agentRawExportsDao,
          engineDeps: buildDepsForJob({
            jobId,
            apiKey: settings.defaultApiKey,
            model: settings.defaultModel,
            defaultAgent: settings.defaultAgentRuntime,
            ssh,
          }),
          runControl: pipelineRunControl.buildForJob(jobId),
          onRunSettled: () => pipelineRunControl.clear(jobId),
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
    pauseRun: (jobId: string) => {
      const result = pipelineRunControl.pause(jobId);
      void jobsDao.updateStatus(jobId, "paused");

      return ok(result);
    },
    resumeRun: (jobId: string) => {
      const result = pipelineRunControl.resume(jobId);
      void jobsDao.updateStatus(jobId, "running");

      return ok(result);
    },
    cancelRun: (jobId: string) => {
      pipelineRunControl.clear(jobId);
      void jobsDao.updateStatus(jobId, "cancelled", { finishedAt: new Date() });

      return ok({ cancelled: true, jobId });
    },
    /** Apply a human decision: wake the suspended decision node (the job stays "running", no status change needed). */
    resolveDecision: (jobId: string, nodeId: string, selectedCandidateIds: string[]) =>
      ok(pipelineRunControl.resolveDecision(jobId, nodeId, selectedCandidateIds)),
  };
};
