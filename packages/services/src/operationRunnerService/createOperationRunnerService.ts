import { ok, err, ResultAsync, type Result } from "neverthrow";
import { initObs, initSpanRecorder, trace } from "@repo/obs";
import { logger } from "@repo/logger";
import type { AgentRuntime, SshConnection } from "@repo/schemas";
import {
  executeOperationNode,
  type OperationNodeContext,
  type OperationInfo,
} from "@repo/pipeline-engine";
import { loopEvaluator } from "../pipelineRunnerService/loopEvaluator";
import { pipelineRunnerEngineDeps } from "../pipelineRunnerService/engineDeps";
import { normalizeSettingsRecord } from "../settingsService/normalizeSettingsRecord";
import {
  createAgentsDao,
  createOperationsDao,
  createJobsDao,
  createJobTracesDao,
  createSkillsDao,
  createBestPracticesDao,
  createAgentRawExportsDao,
  createAgentSpansDao,
  createSettingsDao,
  createAgentRuntimesDao,
  type DbConnection,
} from "@repo/models";

export class OperationNotFoundError extends Error {
  constructor(operationId: string) {
    super(`Operation ${operationId} not found`);
    this.name = "OperationNotFoundError";
  }
}

export const createOperationRunnerService = (db: DbConnection) => {
  const agentsDao = createAgentsDao(db);
  const operationsDao = createOperationsDao(db);
  const jobsDao = createJobsDao(db);
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
          await jobsDao.updateStatus(jobId, "running", { startedAt: new Date() });
          await trace(jobId, `Starting operation "${operation.name}" (${opts.operationId})`);

          const operationInfo: OperationInfo = {
            id: operation.id,
            name: operation.name,
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

          const lookupBestPractice = async (bpId: string) => {
            const bp = await bestPracticesDao.findById(bpId);

            return bp ? { title: bp.title, content: bp.content } : null;
          };

          const lookupAgent = async (agentId: string) => {
            const agent = await agentsDao.findById(agentId);

            return agent
              ? { id: agent.id, name: agent.name, defaultRuntime: agent.defaultRuntime }
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
            lookupBestPractice,
          };

          const result = await executeOperationNode(syntheticNode, input, opCtx);

          if (result.ok) {
            await trace(jobId, `Operation completed successfully (${result.content.length} chars)`);
            await jobsDao.updateStatus(jobId, "done", { finishedAt: new Date() });
          } else {
            const message = result.error?.message ?? "Operation execution failed";
            await trace(jobId, `ERROR: ${message}`, "error");
            await jobsDao.updateStatus(jobId, "failed", {
              finishedAt: new Date(),
              error: message,
            });
          }
        })(),
        (error) => error,
      ).match(
        () => undefined,
        (error) => {
          logger.error(
            { err: error, jobId },
            "operationRunner: unhandled rejection from background operation run",
          );
        },
      );

      return ok({ jobId });
    },
  };
};
