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
import type { NodeRunStatus } from "@repo/schemas";
import type {
  AgentsDao,
  OperationsDao,
  PipelinesDao,
  JobsDao,
  PipelineRunsDao,
  SkillsDao,
  AgentRawExportsDao,
} from "@repo/models";

/**
 * Sum the persisted token usage of every agent raw export attached to the job.
 * Token counts are the only usage currency — there is no monetary cost tracking.
 * Never throws: an aggregation failure yields undefined so the terminal status
 * is still written (without totals) — a successful run must not turn failed
 * because usage bookkeeping broke.
 */
const aggregateUsageTotalsSafely = async ({
  agentRawExportsDao,
  jobId,
}: {
  agentRawExportsDao: AgentRawExportsDao;
  jobId: string;
}): Promise<{ totalTokens: number } | undefined> => {
  const rows = await ResultAsync.fromPromise(
    agentRawExportsDao.findByJobId(jobId),
    (cause) => cause,
  );
  if (rows.isErr()) {
    logger.warn({ err: rows.error, jobId }, "runPipeline: failed to aggregate usage totals");

    return undefined;
  }

  const totalTokens = rows.value.reduce(
    (sum, row) => sum + (row.tokenInput ?? 0) + (row.tokenOutput ?? 0),
    0,
  );

  return { totalTokens };
};

/**
 * A terminal status may only overwrite a live (running/paused) status. In
 * particular, a run cancelled while a node was still executing must stay
 * cancelled when that node later settles as done/failed. Fails open on read
 * errors — leaving a job stuck "running" is worse than a stale overwrite.
 */
const canFinalizeJob = async ({
  jobsDao,
  jobId,
}: {
  jobsDao: JobsDao;
  jobId: string;
}): Promise<boolean> => {
  const current = await ResultAsync.fromPromise(
    (async () => jobsDao.findById(jobId))(),
    (cause) => cause,
  );
  if (current.isErr()) {
    logger.error(
      { err: current.error, jobId },
      "runPipeline: could not read job status before finalizing — proceeding with write",
    );

    return true;
  }

  const status = current.value?.status;

  return status === "running" || status === "paused";
};

/**
 * Serialize node-status writes so concurrent engine callbacks cannot interleave
 * and persist a stale snapshot of the accumulated statuses.
 */
const createNodeStatusWriter = ({ jobsDao, jobId }: { jobsDao: JobsDao; jobId: string }) => {
  const nodeStatuses: Record<string, NodeRunStatus> = {};
  const state = {
    writeQueue: Promise.resolve(),
  };

  return (nodeId: string, status: NodeRunStatus): Promise<void> => {
    state.writeQueue = state.writeQueue.then(async () => {
      nodeStatuses[nodeId] = status;
      const updateResult = await ResultAsync.fromPromise(
        jobsDao.setNodeStatuses(jobId, { ...nodeStatuses }),
        (e) => e,
      );
      if (updateResult.isErr()) {
        logger.error(
          { err: updateResult.error, jobId, nodeId, status },
          "runPipeline: failed to update node status",
        );
      }
    });

    return state.writeQueue;
  };
};

/**
 * Top up usage totals on a job that was finalized out-of-band (e.g. cancelled
 * while its last node was executing), preserving whatever terminal status it
 * already has. Never throws.
 */
const recordUsageOnFinalizedJobSafely = async ({
  jobsDao,
  jobId,
  usageTotals,
}: {
  jobsDao: JobsDao;
  jobId: string;
  usageTotals?: { totalTokens: number };
}): Promise<void> => {
  if (!usageTotals) return;

  const current = await ResultAsync.fromPromise(
    (async () => jobsDao.findById(jobId))(),
    (cause) => cause,
  );
  const status = current.isOk() ? current.value?.status : undefined;
  if (!status) {
    logger.warn({ jobId }, "runPipeline: could not record usage totals on finalized job");

    return;
  }

  const safeUpdate = await ResultAsync.fromPromise(
    jobsDao.updateStatus(jobId, status, { ...usageTotals }),
    (e) => e,
  );
  if (safeUpdate.isErr()) {
    logger.warn(
      { err: safeUpdate.error, jobId },
      "runPipeline: failed to record usage totals on finalized job",
    );
  }
};

/**
 * Mark a job as failed. Swallows any DAO/trace errors to guarantee the caller
 * never sees an unhandled rejection from this helper. Skips the write when the
 * job already left the running/paused states (e.g. it was cancelled).
 */
const failJobSafely = async ({
  jobsDao,
  jobId,
  message,
  usageTotals,
}: {
  jobsDao: JobsDao;
  jobId: string;
  message: string;
  usageTotals?: { totalTokens: number };
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

  if (!(await canFinalizeJob({ jobsDao, jobId }))) {
    logger.info(
      { jobId },
      "runPipeline: job already finalized elsewhere — not overwriting with failed",
    );

    return;
  }

  const safeUpdate = await ResultAsync.fromPromise(
    jobsDao.updateStatus(jobId, "failed", {
      finishedAt: new Date(),
      error: message,
      ...usageTotals,
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
    selfHealRetries?: number;
    pipelinesDao: PipelinesDao;
    operationsDao: OperationsDao;
    agentsDao: AgentsDao;
    jobsDao: JobsDao;
    pipelineRunsDao: PipelineRunsDao;
    skillsDao: SkillsDao;
    agentRawExportsDao: AgentRawExportsDao;
    engineDeps: PipelineEngineDeps;
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
    const updateNodeStatus = createNodeStatusWriter({ jobsDao, jobId });

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
        const usageTotals = await aggregateUsageTotalsSafely({ agentRawExportsDao, jobId });

        if (outcome.ok) {
          await pipelineRunsDao.update(jobId, { result: { summary: outcome.summary } });
          if (await canFinalizeJob({ jobsDao, jobId })) {
            await jobsDao.updateStatus(jobId, "done", {
              finishedAt: new Date(),
              ...usageTotals,
            });
          } else {
            logger.info(
              { jobId },
              "runPipeline: job already finalized elsewhere — not overwriting with done",
            );
            // The job was cancelled while its last node was executing; the
            // usage gathered so far must still land on the record.
            await recordUsageOnFinalizedJobSafely({ jobsDao, jobId, usageTotals });
          }
        } else if (outcome.error instanceof PipelineCancelledError) {
          // cancelRun already persisted the cancelled status and finishedAt.
          // Re-assert "cancelled" here (a cancel racing the initial "running"
          // write would otherwise leave the job stuck as running) and record
          // the usage totals gathered so far.
          await trace(jobId, `Run cancelled: ${outcome.error.message}`);
          const safeUpdate = await ResultAsync.fromPromise(
            jobsDao.updateStatus(jobId, "cancelled", { ...usageTotals }),
            (e) => e,
          );
          if (safeUpdate.isErr()) {
            logger.warn(
              { err: safeUpdate.error, jobId },
              "runPipeline: failed to record usage totals on cancelled job",
            );
          }
        } else {
          await failJobSafely({
            jobsDao,
            jobId,
            message: outcome.error.message,
            usageTotals,
          });
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

    opts.onRunSettled?.();
  },
};
