import { ok, err, ResultAsync, type Result } from "neverthrow";

import { logger } from "@repo/logger";
import type { JobTriggeredBy } from "@repo/schemas";

import { pipelineRunExecutor } from "../../helpers/runPipeline";
import { pipelineRunControl } from "../../helpers/runControl";
import { normalizeSettingsRecord } from "../../../settingsService/helpers/normalizeSettingsRecord";

import {
  checkPipelineOperationReferences,
  type PipelineOperationReferencesError,
} from "../../../pipelinesService/helpers/checkPipelineOperationReferences/checkPipelineOperationReferences.helper";
import type { ServiceError } from "../../../serviceErrors";

import type {
  PipelineNotFoundError,
  AgentRuntimeNotFoundError,
} from "../../pipelineRunner.service";

import type { PipelineRunnerServiceBindings } from "../../contracts";
export const createStartRunMethod =
  (
    serviceBindings: Pick<
      PipelineRunnerServiceBindings,
      | "pipelinesDao"
      | "PipelineNotFoundError"
      | "operationsDao"
      | "settingsDao"
      | "agentRuntimesDao"
      | "AgentRuntimeNotFoundError"
      | "jobsDao"
      | "pipelineRunsDao"
      | "agentsDao"
      | "skillsDao"
      | "agentRawExportsDao"
      | "buildDepsForJob"
      | "buildMcpConnectorInjectionProvider"
      | "options"
    >,
  ) =>
  async (opts: {
    pipelineId: string;
    inputPath?: string;
    githubToken?: string;
    inputs?: Record<string, string>;
    /** Per-device autonomy preference sent with the request (0 = no self-heal retries). */
    selfHealRetries?: number;
    triggeredBy?: JobTriggeredBy;
    runtimeConfigId?: string;
    model?: string;
    reasoningEffort?: string;
    speed?: string;
    firstOutputTimeoutMs?: number;
  }): Promise<
    Result<
      { jobId: string },
      | PipelineNotFoundError
      | AgentRuntimeNotFoundError
      | PipelineOperationReferencesError
      | ServiceError
    >
  > => {
    const pipeline = await serviceBindings.pipelinesDao.findById(opts.pipelineId);
    if (!pipeline) {
      return err(new serviceBindings.PipelineNotFoundError(opts.pipelineId));
    }

    const operationReferenceCheck = await checkPipelineOperationReferences({
      nodes: pipeline.nodes,
      operationsDao: serviceBindings.operationsDao,
      pipelineId: pipeline.id,
    });
    if (operationReferenceCheck.isErr()) return err(operationReferenceCheck.error);

    const [settingsRecord, allRuntimes] = await Promise.all([
      serviceBindings.settingsDao.get(),
      serviceBindings.agentRuntimesDao.findMany(),
    ]);
    const settings = normalizeSettingsRecord(settingsRecord);
    const requestedRuntime = opts.runtimeConfigId
      ? allRuntimes.find((runtime) => runtime.id === opts.runtimeConfigId)
      : undefined;
    if (opts.runtimeConfigId && !requestedRuntime) {
      return err(new serviceBindings.AgentRuntimeNotFoundError(opts.runtimeConfigId));
    }
    const runtimeConfig =
      requestedRuntime ??
      allRuntimes.find((runtime) => runtime.id === settings.defaultAgentRuntimeConfigId) ??
      allRuntimes.find((runtime) => runtime.type === settings.defaultAgentRuntime) ??
      allRuntimes[0];
    if (!runtimeConfig) {
      return err(new serviceBindings.AgentRuntimeNotFoundError());
    }

    const jobId = crypto.randomUUID();
    await serviceBindings.jobsDao.create({
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

    await serviceBindings.pipelineRunsDao.create({
      id: jobId,
      pipelineId: opts.pipelineId,
      projectId: null,
      inputPath: opts.inputPath ?? null,
      logs: [],
      result: null,
    });

    // Resolve SSH connection from agent runtimes config
    const ssh = runtimeConfig.connection.mode === "ssh" ? runtimeConfig.connection : undefined;

    const runControl = pipelineRunControl.buildForJob(jobId);
    void ResultAsync.fromPromise(
      pipelineRunExecutor.run({
        pipelineId: opts.pipelineId,
        inputPath: opts.inputPath,
        githubToken: opts.githubToken,
        inputs: opts.inputs,
        defaultOutputPath: settings.defaultOutputPath,
        selfHealRetries: opts.selfHealRetries,
        jobId,
        pipelinesDao: serviceBindings.pipelinesDao,
        operationsDao: serviceBindings.operationsDao,
        agentsDao: serviceBindings.agentsDao,
        jobsDao: serviceBindings.jobsDao,
        pipelineRunsDao: serviceBindings.pipelineRunsDao,
        skillsDao: serviceBindings.skillsDao,
        agentRawExportsDao: serviceBindings.agentRawExportsDao,
        engineDeps: (0, serviceBindings.buildDepsForJob)({
          jobId,
          apiKey: settings.defaultApiKey,
          model: opts.model ?? settings.defaultModel,
          reasoningEffort: opts.reasoningEffort,
          speed: opts.speed,
          firstOutputTimeoutMs: opts.firstOutputTimeoutMs,
          runtimeConfigId: runtimeConfig.id,
          executablePath:
            runtimeConfig.connection.mode === "local" ? runtimeConfig.connection.path : undefined,
          defaultAgent: runtimeConfig.type,
          overrideOperationRoute: Boolean(
            opts.runtimeConfigId ||
            opts.model ||
            opts.reasoningEffort ||
            opts.speed ||
            opts.firstOutputTimeoutMs !== undefined,
          ),
          ssh,
          getMcpConnectorInjection: (0, serviceBindings.buildMcpConnectorInjectionProvider)(
            runtimeConfig.type,
          ),
          signal: pipelineRunControl.signal(jobId),
        }),
        jobLease: serviceBindings.options.jobLease,
        runControl,
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
  };
