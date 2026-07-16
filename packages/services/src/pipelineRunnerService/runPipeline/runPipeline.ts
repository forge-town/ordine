import { ResultAsync } from "neverthrow";
import { trace } from "@repo/obs";
import { logger } from "@repo/logger";
import {
  pipelineEngine,
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
 */
const aggregateUsageTotals = async ({
  agentRawExportsDao,
  jobId,
}: {
  agentRawExportsDao: AgentRawExportsDao;
  jobId: string;
}): Promise<{ totalTokens: number }> => {
  const rows = await agentRawExportsDao.findByJobId(jobId);
  const totalTokens = rows.reduce(
    (sum, row) => sum + (row.tokenInput ?? 0) + (row.tokenOutput ?? 0),
    0,
  );

  return { totalTokens };
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
 * Mark a job as failed. Swallows any DAO/trace errors to guarantee the caller
 * never sees an unhandled rejection from this helper.
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
        const usageTotals = await aggregateUsageTotals({ agentRawExportsDao, jobId });

        if (outcome.ok) {
          await pipelineRunsDao.update(jobId, { result: { summary: outcome.summary } });
          await jobsDao.updateStatus(jobId, "done", {
            finishedAt: new Date(),
            ...usageTotals,
          });
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
