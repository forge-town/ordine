import { ok, err, ResultAsync, type Result } from "neverthrow";
import { initObs, initSpanRecorder } from "@repo/obs";
import { logger } from "@repo/logger";
import type { AgentRuntime, JobStatus, JobTriggeredBy, SshConnection } from "@repo/schemas";
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

export class JobNotFoundError extends Error {
  constructor(jobId: string) {
    super(`Job ${jobId} not found`);
    this.name = "JobNotFoundError";
  }
}

export class InvalidJobStatusError extends Error {
  constructor(action: string, jobId: string, status: string, allowed: readonly string[]) {
    super(
      `Cannot ${action} job ${jobId}: status is "${status}" but must be one of ${allowed.join(", ")}`,
    );
    this.name = "InvalidJobStatusError";
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

  /** Run-control actions only apply to live jobs in an eligible status. */
  const guardJobStatus = async (
    action: string,
    jobId: string,
    allowed: readonly JobStatus[],
  ): Promise<Result<void, JobNotFoundError | InvalidJobStatusError>> => {
    const job = await jobsDao.findById(jobId);
    if (!job) return err(new JobNotFoundError(jobId));
    if (!allowed.includes(job.status)) {
      return err(new InvalidJobStatusError(action, jobId, job.status, allowed));
    }

    return ok(undefined);
  };

  const persistStatus = (
    jobId: string,
    status: JobStatus,
    extra?: { finishedAt?: Date },
  ): ResultAsync<unknown, Error> =>
    ResultAsync.fromPromise(
      jobsDao.updateStatus(jobId, status, extra),
      (cause) =>
        new Error(
          `Failed to persist status "${status}" for job ${jobId}: ${cause instanceof Error ? cause.message : String(cause)}`,
        ),
    );

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
        triggeredBy: opts.triggeredBy ?? "manual",
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
    pauseRun: async (jobId: string): Promise<Result<{ jobId: string; paused: boolean }, Error>> => {
      const guard = await guardJobStatus("pause", jobId, ["running"]);
      if (guard.isErr()) return err(guard.error);

      const write = await persistStatus(jobId, "paused");
      if (write.isErr()) return err(write.error);

      return ok(pipelineRunControl.pause(jobId));
    },
    resumeRun: async (
      jobId: string,
    ): Promise<Result<{ jobId: string; resumed: boolean }, Error>> => {
      // "running" is also eligible: a checkpoint node suspends the run while
      // the job status stays "running". Resuming a non-suspended running job
      // is harmless — the status write is idempotent and no waiter is parked.
      const guard = await guardJobStatus("resume", jobId, ["paused", "running"]);
      if (guard.isErr()) return err(guard.error);

      const write = await persistStatus(jobId, "running");
      if (write.isErr()) return err(write.error);

      return ok(pipelineRunControl.resume(jobId));
    },
    cancelRun: async (
      jobId: string,
    ): Promise<Result<{ jobId: string; cancelled: boolean }, Error>> => {
      // "queued" is eligible too: it allows cancelling a run right after start
      // and is the only way to clean up a job stuck in queued.
      const guard = await guardJobStatus("cancel", jobId, ["queued", "running", "paused"]);
      if (guard.isErr()) return err(guard.error);

      // Persist the cancelled status before releasing any waiter, so the
      // executor's terminal-status guard reliably sees "cancelled".
      const write = await persistStatus(jobId, "cancelled", { finishedAt: new Date() });
      if (write.isErr()) return err(write.error);

      return ok(pipelineRunControl.cancel(jobId));
    },
    /**
     * Apply a human decision: wake the suspended decision node (the job stays
     * "running", no status change needed). `selectedCandidateIds` are the
     * candidateId values from PipelineDecisionEvent.candidates (incoming edge
     * ids), not node ids.
     */
    resolveDecision: (jobId: string, nodeId: string, selectedCandidateIds: string[]) =>
      ok(pipelineRunControl.resolveDecision(jobId, nodeId, selectedCandidateIds)),
  };
};
