import { ok, err, ResultAsync, type Result } from "neverthrow";
import { trace } from "@repo/obs";
import { logger } from "@repo/logger";
import type { AgentRuntime } from "@repo/schemas";
import {
  executeOperationNode,
  type OperationNodeContext,
  type OperationInfo,
} from "@repo/pipeline-engine";

import { normalizeSettingsRecord } from "../../../settingsService/helpers/normalizeSettingsRecord";
import type {
  createAgentsDao,
  createOperationsDao,
  createJobsDao,
  createSkillsDao,
  createSettingsDao,
  createAgentRuntimesDao,
} from "@repo/models";
import { createJobLeaseController, type JobLeaseTimingOptions } from "../../../jobLease";
import { OperationNotFoundError } from "../../contracts";
import type { createFailJobSafelyHelper } from "../../helpers/failJobSafely";
import type { createBuildDepsForJobHelper } from "../../helpers/buildDepsForJob";
export const createStartRunMethod =
  (
    agentsDao: ReturnType<typeof createAgentsDao>,
    operationsDao: ReturnType<typeof createOperationsDao>,
    jobsDao: ReturnType<typeof createJobsDao>,
    skillsDao: ReturnType<typeof createSkillsDao>,
    settingsDao: ReturnType<typeof createSettingsDao>,
    agentRuntimesDao: ReturnType<typeof createAgentRuntimesDao>,
    jobLeaseOptions: JobLeaseTimingOptions | undefined,
    failJobSafely: ReturnType<typeof createFailJobSafelyHelper>,
    buildDepsForJob: ReturnType<typeof createBuildDepsForJobHelper>,
  ) =>
  async (opts: {
    operationId: string;
    inputPath?: string;
    inputContent?: string;
    agentOverride?: AgentRuntime;
  }): Promise<Result<{ jobId: string }, OperationNotFoundError>> => {
    const operation = await operationsDao.findById(opts.operationId);
    if (!operation) {
      return err(new OperationNotFoundError(opts.operationId));
    }

    const jobId = crypto.randomUUID();
    await jobsDao.create({
      id: jobId,
      title: `Run operation: ${operation.name}`,
      type: "operation_run",
      error: null,
      status: "queued",
      startedAt: null,
      finishedAt: null,
    });
    const lease = createJobLeaseController({
      jobsDao,
      jobId,
      options: jobLeaseOptions,
    });

    const settings = normalizeSettingsRecord(await settingsDao.get());

    const allRuntimes = await agentRuntimesDao.findMany();
    const runtimeConfig = allRuntimes.find(
      (r) => r.type === settings.defaultAgentRuntime && r.connection.mode === "ssh",
    );
    const ssh = runtimeConfig?.connection.mode === "ssh" ? runtimeConfig.connection : undefined;

    const engineDeps = buildDepsForJob({
      jobId,
      apiKey: settings.defaultApiKey,
      model: settings.defaultModel,
      defaultAgent: opts.agentOverride ?? settings.defaultAgentRuntime,
      ssh,
    });

    void ResultAsync.fromPromise(
      (async () => {
        const claimed = await lease.claim();
        if (!claimed) {
          logger.info({ jobId }, "operationRunner: execution lease was not claimed");

          return;
        }
        lease.start();
        await trace(jobId, `Starting operation "${operation.name}" (${opts.operationId})`);

        const operationInfo: OperationInfo = {
          id: operation.id,
          name: operation.name,
          description: operation.description ?? "",
          config: operation.config,
        };
        const operationsMap = new Map<string, OperationInfo>();
        operationsMap.set(operation.id, operationInfo);

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
            ? {
                id: agent.id,
                name: agent.name,
                defaultRuntime: agent.defaultRuntime,
                defaultModel: agent.defaultModel,
              }
            : null;
        };

        const nodeOutputs = new Map();
        const input = {
          inputPath: opts.inputPath ?? "",
          content: opts.inputContent ?? "",
        };

        const syntheticNode = {
          id: `op-run-${jobId}`,
          type: "operation" as const,
          position: { x: 0, y: 0 },
          data: {
            label: operation.name,
            nodeType: "operation" as const,
            operationId: operation.id,
            operationName: operation.name,
            status: "idle" as const,
            agentRuntime: opts.agentOverride,
          },
        };

        const opCtx: OperationNodeContext = {
          node: syntheticNode,
          input,
          deps: engineDeps,
          nodeOutputs,
          tempDirs: [],
          jobId,
          operations: operationsMap,
          lookupAgent,
          lookupSkill,
        };

        const result = await executeOperationNode(syntheticNode, input, opCtx);

        if (result.outcome === "completed") {
          await trace(jobId, `Operation completed successfully (${result.content.length} chars)`);
          const finalized = await jobsDao.transitionStatus(jobId, ["running", "paused"], "done", {
            finishedAt: new Date(),
          });
          if (!finalized) {
            logger.info(
              { jobId },
              "operationRunner: job already finalized elsewhere — not overwriting with done",
            );
          }
        } else {
          const message =
            result.outcome === "failed"
              ? result.error.message
              : "Operation was skipped (incomplete configuration)";
          await failJobSafely(jobId, message);
        }
      })(),
      (error) => error,
    ).match(
      () => lease.stop(),
      async (error) => {
        lease.stop();
        logger.error(
          { err: error, jobId },
          "operationRunner: unhandled rejection from background operation run",
        );
        await failJobSafely(
          jobId,
          `Unhandled error: ${error instanceof Error ? error.message : String(error)}`,
        );
      },
    );

    return ok({ jobId });
  };
