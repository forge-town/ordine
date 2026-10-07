import { ResultAsync } from "neverthrow";
import { trace } from "@repo/obs";
import { logger } from "@repo/logger";
import {
  pipelineEngine,
  PipelineCancelledError,
  ScriptExecutionError,
  type PipelineEngineDeps,
  type PipelineRunControl,
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
  AgentRawExportsDao,
} from "@repo/models";
import { createJobLeaseController, type JobLeaseTimingOptions } from "../../../jobLease";

import type { RunPipelineAssemblyBindings } from "../../contracts";
export const createRunPipelineRunMethod =
  (
    serviceBindings: Pick<
      RunPipelineAssemblyBindings,
      | "createNodeStatusWriter"
      | "failJobSafely"
      | "aggregateUsageTotalsSafely"
      | "recordUsageOnFinalizedJobSafely"
    >,
  ) =>
  async (opts: {
    pipelineId: string;
    inputPath?: string;
    inputs?: Record<string, string>;
    jobId: string;
    githubToken?: string;
    defaultOutputPath?: string;
    selfHealRetries?: number;
    pipelinesDao: PipelinesDao;
    operationsDao: OperationsDao;
    agentsDao: AgentsDao;
    jobsDao: JobsDao;
    pipelineRunsDao: PipelineRunsDao;
    skillsDao: SkillsDao;
    agentRawExportsDao: AgentRawExportsDao;
    engineDeps: PipelineEngineDeps;
    jobLease?: JobLeaseTimingOptions;
    runControl?: PipelineRunControl;
    onRunSettled?: () => void;
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
      agentRawExportsDao,
      engineDeps,
    } = opts;
    const updateNodeStatus = (0, serviceBindings.createNodeStatusWriter)({ jobsDao, jobId });
    const lease = createJobLeaseController({ jobsDao, jobId, options: opts.jobLease });

    const runResult = await ResultAsync.fromPromise(
      (async () => {
        const claimed = await lease.claim();
        if (!claimed) {
          logger.info({ jobId }, "runPipeline: execution lease was not claimed");

          return;
        }
        lease.start();
        await trace(jobId, `Starting pipeline ${pipelineId}`);

        const pipeline = await pipelinesDao.findById(pipelineId);
        if (!pipeline) {
          await (0, serviceBindings.failJobSafely)({
            jobsDao,
            jobId,
            message: `Pipeline ${pipelineId} not found`,
          });

          return;
        }

        const operationIds = pipeline.nodes
          .map((n) => (n.data.nodeType === "operation" ? n.data.operationId : undefined))
          .filter((id): id is string => id !== undefined && id !== "");

        const operationsMap = new Map<string, OperationInfo>();
        for (const id of operationIds) {
          const op = await operationsDao.findById(id);
          if (op) {
            operationsMap.set(id, {
              id: op.id,
              name: op.name,
              description: op.description ?? "",
              config: op.config,
            });
          }
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
            ? {
                id: agent.id,
                name: agent.name,
                defaultRuntime: agent.defaultRuntime,
                defaultModel: agent.defaultModel,
              }
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
              description: pipeline.description,
              sharedContext: pipeline.sharedContext,
              nodes,
              edges: pipeline.edges,
            },
            jobId,
            inputPath: opts.inputPath,
            githubToken,
            defaultOutputPath: opts.defaultOutputPath,
            selfHealRetries: opts.selfHealRetries,
            operations: operationsMap,
            deps: engineDeps,
            lookupAgent,
            lookupSkill,
            onNodeStatusChange: ({ nodeId, status }) => updateNodeStatus(nodeId, status),
            runControl: opts.runControl,
          }),
          (cause): PipelineRunError =>
            new ScriptExecutionError(cause instanceof Error ? cause.message : String(cause), cause),
        );

        const outcome = result.isOk() ? result.value : { ok: false as const, error: result.error };
        const usageTotals = await (0, serviceBindings.aggregateUsageTotalsSafely)({
          agentRawExportsDao,
          jobId,
        });

        if (outcome.ok) {
          await pipelineRunsDao.update(jobId, { result: { summary: outcome.summary } });
          const finalized = await jobsDao.transitionStatus(jobId, ["running", "paused"], "done", {
            finishedAt: new Date(),
            ...usageTotals,
          });
          if (!finalized) {
            logger.info(
              { jobId },
              "runPipeline: job already finalized elsewhere — not overwriting with done",
            );
            // The job was cancelled while its last node was executing; the
            // usage gathered so far must still land on the record.
            await (0, serviceBindings.recordUsageOnFinalizedJobSafely)({
              jobsDao,
              jobId,
              usageTotals,
            });
          }
        } else if (outcome.error instanceof PipelineCancelledError) {
          // cancelRun already persisted the cancelled status and finishedAt.
          // Re-assert "cancelled" here (a cancel racing the initial "running"
          // write would otherwise leave the job stuck as running) and record
          // the usage totals gathered so far.
          await trace(jobId, `Run cancelled: ${outcome.error.message}`);
          const safeUpdate = await ResultAsync.fromPromise(
            jobsDao.transitionStatus(jobId, ["queued", "running", "paused"], "cancelled", {
              ...usageTotals,
            }),
            (e) => e,
          );
          if (safeUpdate.isErr()) {
            logger.warn(
              { err: safeUpdate.error, jobId },
              "runPipeline: failed to record usage totals on cancelled job",
            );
          } else if (!safeUpdate.value) {
            await (0, serviceBindings.recordUsageOnFinalizedJobSafely)({
              jobsDao,
              jobId,
              usageTotals,
            });
          }
        } else {
          await (0, serviceBindings.failJobSafely)({
            jobsDao,
            jobId,
            message: outcome.error.message,
            usageTotals,
          });
        }
      })(),
      (cause) => (cause instanceof Error ? cause : new Error(String(cause))),
    );
    lease.stop();

    if (runResult.isErr()) {
      logger.error({ err: runResult.error, jobId }, "runPipeline: unhandled error in pipeline run");
      await (0, serviceBindings.failJobSafely)({
        jobsDao,
        jobId,
        message: `Unhandled error: ${runResult.error.message}`,
      });
    }

    opts.onRunSettled?.();
  };
