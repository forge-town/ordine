import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import type { ExecutionJobRecord, ExecutionNodeAttemptRecord } from "@repo/db-schema";
import {
  EXECUTION_MAX_TIMEOUT_MS,
  ExecutionArtifactSchema,
  ExecutionErrorSchema,
  ExecutionIdentifierSchema,
  ExecutionJsonObjectSchema,
  ExecutionNodeStateSchema,
  ExecutionPortValuesSchema,
  ExecutionPrincipalSchema,
  ExecutionTerminalJobStateSchema,
  ExecutionWarningsSchema,
  type ExecutionJobState,
  type ExecutionNodeState,
  type ExecutionPrincipal,
  type PreparedRun,
  type ExecutionJsonObject,
} from "@repo/schemas";
import {
  createExecutionJobsDao,
  createExecutionPreparedRunsDao,
  createExecutionNodeAttemptsDao,
  createExecutionEventsDao,
  createExecutionArtifactsDao,
  createExecutionPipelineRunsDao,
  createExecutionRunRequestsDao,
} from "../../daos/executionDaos";
import type { DbConnection, DbExecutor } from "../../types";
import type {
  ExecutionIdentity,
  ExecutionLease,
  ExecutionAttemptStart,
  ExecutionAttemptFinish,
  ExecutionJobFinish,
  ExecutionEventAppend,
  ExecutionArtifactRegistration,
} from "../../executionTypes";
import {
  ExecutionIntegrityError,
  ExecutionNotFoundError,
  ExecutionScopeError,
  hashExecutionJson,
  verifyPreparedRun,
} from "../executionRepository";
import {
  ExecutionJobDeadlineError,
  ExecutionJobStateConflictError,
  ExecutionLeaseLostError,
} from "./executionJobErrors";

const ACTIVE = [
  "running",
  "pausing",
  "paused",
  "waiting_for_input",
  "cancelling",
] satisfies ExecutionJobState[];
const ATTEMPT_ACTIVE = ["queued", "running", "waiting_for_input"] satisfies ExecutionNodeState[];
const RESERVED_EVENTS = new Set([
  "node_state",
  "checkpoint_acknowledged",
  "job_finished",
  "job_claimed",
  "job_control",
  "attempt_started",
  "attempt_finished",
  "artifact_registered",
]);
const terminalJob = (state: ExecutionJobState) =>
  ExecutionTerminalJobStateSchema.safeParse(state).success;
const terminalAttempt = (state: ExecutionNodeState) =>
  !ATTEMPT_ACTIVE.includes(state as (typeof ATTEMPT_ACTIVE)[number]);
const validateLeaseDuration = (leaseMs: number) => {
  if (!Number.isSafeInteger(leaseMs) || leaseMs < 1 || leaseMs > EXECUTION_MAX_TIMEOUT_MS)
    throw new ExecutionIntegrityError("Invalid executor lease duration");
};
const validateLease = (lease: ExecutionLease) => {
  if (
    ![lease.jobId, lease.executorId, lease.subjectId, lease.workspaceId].every(
      (id) => ExecutionIdentifierSchema.safeParse(id).success,
    ) ||
    !Number.isSafeInteger(lease.generation) ||
    lease.generation < 0
  )
    throw new ExecutionLeaseLostError();
};
const nowAt = async (executor: DbExecutor): Promise<Date> => {
  const rows = await executor.execute(sql`SELECT clock_timestamp() AS now`);
  const value = rows[0]?.["now"];
  const now = value instanceof Date ? value : new Date(String(value));
  if (!Number.isFinite(now.getTime()))
    throw new ExecutionIntegrityError("Database clock is unavailable");

  return now;
};
const asLease = (job: ExecutionJobRecord): ExecutionLease => {
  if (!job.executorId) throw new ExecutionLeaseLostError();

  return {
    jobId: job.id,
    workspaceId: job.workspaceId,
    subjectId: job.subjectId,
    executorId: job.executorId,
    generation: job.generation,
  };
};
const leaseValid = (job: ExecutionJobRecord, lease: ExecutionLease, now: Date) =>
  job.id === lease.jobId &&
  job.workspaceId === lease.workspaceId &&
  job.subjectId === lease.subjectId &&
  job.executorId === lease.executorId &&
  job.generation === lease.generation &&
  Boolean(job.leaseExpiresAt && job.leaseExpiresAt.getTime() > now.getTime()) &&
  !terminalJob(job.state);
const budgetExpired = (job: ExecutionJobRecord, now: Date) =>
  Boolean(
    (job.deadlineAt && job.deadlineAt.getTime() <= now.getTime()) ||
    (job.waitingDeadlineAt && job.waitingDeadlineAt.getTime() <= now.getTime()),
  );
const requireActiveBudget = (job: ExecutionJobRecord, now: Date) => {
  if (budgetExpired(job, now)) throw new ExecutionJobDeadlineError();
};
const controlPrincipal = (input: ExecutionPrincipal) => {
  const principal = ExecutionPrincipalSchema.parse(input);
  if (!principal.scopes.includes("execution:control"))
    throw new ExecutionScopeError("execution:control");

  return principal;
};
const preparedFor = async (executor: DbExecutor, job: ExecutionJobRecord): Promise<PreparedRun> => {
  const row = await createExecutionPreparedRunsDao(executor).findById(job, job.preparedRunId);
  if (!row) throw new ExecutionIntegrityError("Job has no immutable PreparedRun");
  const prepared = verifyPreparedRun(row.prepared);
  if (
    row.contentHash !== prepared.contentHash ||
    prepared.subjectId !== job.subjectId ||
    prepared.workspaceId !== job.workspaceId ||
    prepared.id !== job.preparedRunId
  )
    throw new ExecutionIntegrityError("Job snapshot identity is inconsistent");

  return prepared;
};
const summaryFor = async (executor: DbExecutor, job: ExecutionJobRecord) => {
  const prepared = await preparedFor(executor, job);
  const request = await createExecutionRunRequestsDao(executor).findScopedById(
    job,
    job.runRequestId,
  );
  if (
    !request ||
    request.preparedRunId !== prepared.id ||
    request.input.requestId !== request.requestId ||
    request.input.pipelineId !== prepared.pipeline.id ||
    request.input.expectedRevision !== prepared.pipeline.revision
  )
    throw new ExecutionIntegrityError("Job request snapshot identity is inconsistent");

  return {
    job,
    pipelineId: prepared.pipeline.id,
    pipelineName: prepared.pipeline.name,
    pipelineRevision: prepared.pipeline.revision,
    requestId: request.requestId,
  };
};
const graphNode = (prepared: PreparedRun, nodeId: string) => {
  const node = prepared.pipeline.graph.nodes.find((candidate) => candidate.id === nodeId);
  if (!node) throw new ExecutionNotFoundError("Prepared graph node");

  return node;
};
const nodeOperation = (prepared: PreparedRun, nodeId: string) => {
  const node = graphNode(prepared, nodeId);
  const operation = prepared.operations.find(
    (candidate) =>
      candidate.id === node.operation.operationId && candidate.revision === node.operation.revision,
  );
  if (!operation) throw new ExecutionIntegrityError("Prepared Operation is missing");

  return operation;
};
const latestAttempts = (attempts: ExecutionNodeAttemptRecord[]) => {
  const latest = new Map<string, ExecutionNodeAttemptRecord>();
  for (const attempt of attempts) {
    const previous = latest.get(attempt.nodeId);
    if (
      !previous ||
      attempt.iteration > previous.iteration ||
      (attempt.iteration === previous.iteration && attempt.attemptNumber > previous.attemptNumber)
    )
      latest.set(attempt.nodeId, attempt);
  }

  return latest;
};
const ensureKnownPorts = (
  prepared: PreparedRun,
  nodeId: string,
  values: unknown,
  direction: "inputPorts" | "outputPorts",
) => {
  const parsed = ExecutionPortValuesSchema.parse(values);
  const ports = new Set(nodeOperation(prepared, nodeId)[direction].map((port) => port.id));
  if (Object.keys(parsed).some((port) => !ports.has(port)))
    throw new ExecutionIntegrityError("Attempt values reference an unknown Operation port");

  return parsed;
};
const persistNodeState = (
  executor: DbExecutor,
  jobId: string,
  nodeId: string,
  state: ExecutionNodeState,
  payload: ExecutionJsonObject = {},
) =>
  createExecutionEventsDao(executor).create({
    jobId,
    nodeId,
    type: "node_state",
    payload: ExecutionJsonObjectSchema.parse({ ...payload, state }),
  });
const waitingWithoutAck = async (
  executor: DbExecutor,
  job: ExecutionJobRecord,
): Promise<boolean> => {
  const dao = createExecutionEventsDao(executor);
  const states = await dao.latestNodeStates(job.id);
  for (const state of states) {
    if (
      state.nodeId &&
      state.payload["state"] === "waiting_for_input" &&
      !(await dao.findCheckpointAcknowledgement(job.id, state.nodeId))
    )
      return true;
  }

  return false;
};
const timeoutPatch = (job: ExecutionJobRecord) => ({
  state: "cancelling" as const,
  stopReason: job.stopReason ?? ("timed_out" as const),
});
const resumePatch = (job: ExecutionJobRecord, now: Date, blocked: boolean) => {
  if (budgetExpired(job, now)) return timeoutPatch(job);
  if (job.state === "pausing") return { state: "running" as const, pauseRequestedAt: null };
  if (blocked) return { state: "waiting_for_input" as const, pauseRequestedAt: null };
  const waitingRemainingMs = job.waitingDeadlineAt
    ? Math.max(0, job.waitingDeadlineAt.getTime() - now.getTime())
    : job.waitingRemainingMs;
  if (!waitingRemainingMs || !job.activeRemainingMs) return timeoutPatch(job);

  return {
    state: "running" as const,
    pauseRequestedAt: null,
    waitingRemainingMs,
    waitingDeadlineAt: null,
    deadlineAt: new Date(now.getTime() + job.activeRemainingMs),
  };
};

const settleAttempts = async (
  executor: DbExecutor,
  job: ExecutionJobRecord,
  prepared: PreparedRun,
  state: ExecutionJobFinish["state"],
  now: Date,
) => {
  const attemptsDao = createExecutionNodeAttemptsDao(executor);
  const attempts = await attemptsDao.listByJob(job.id);
  const unfinished = attempts.filter((attempt) => !terminalAttempt(attempt.state));
  if (state === "succeeded" && unfinished.length > 0)
    throw new ExecutionJobStateConflictError("Cannot succeed while attempts are unfinished");
  for (const attempt of unfinished) {
    const nodeState = state === "succeeded" ? "skipped" : state;
    await attemptsDao.transition(job.id, attempt.id, ATTEMPT_ACTIVE, {
      state: nodeState,
      finishedAt: now,
    });
    await persistNodeState(executor, job.id, attempt.nodeId, nodeState, { reason: "job_terminal" });
  }
  const attemptedNodes = new Set(attempts.map((attempt) => attempt.nodeId));
  const stateEvents = await createExecutionEventsDao(executor).latestNodeStates(job.id);
  const knownStates = new Map(stateEvents.map((event) => [event.nodeId, event.payload["state"]]));
  for (const node of prepared.pipeline.graph.nodes) {
    const nodeState = ExecutionNodeStateSchema.safeParse(knownStates.get(node.id));
    if (!attemptedNodes.has(node.id) && !(nodeState.success && terminalAttempt(nodeState.data)))
      await persistNodeState(executor, job.id, node.id, "skipped", { reason: `job_${state}` });
  }

  return attempts;
};

export const createExecutionJobRepository = (
  db: DbConnection,
  options: {
    maxJobArtifactBytes?: number;
    maxJobArtifacts?: number;
    maxRuntimeEvents?: number;
    maxRuntimeEventBytes?: number;
  } = {},
) => {
  const maxJobArtifactBytes = options.maxJobArtifactBytes ?? 500 * 1024 * 1024;
  const maxJobArtifacts = options.maxJobArtifacts ?? 1000;
  const maxRuntimeEvents = options.maxRuntimeEvents ?? 20_000;
  const maxRuntimeEventBytes = options.maxRuntimeEventBytes ?? 32 * 1024 * 1024;
  if (
    ![maxJobArtifactBytes, maxJobArtifacts, maxRuntimeEvents, maxRuntimeEventBytes].every(
      (value) => Number.isSafeInteger(value) && value > 0,
    )
  )
    throw new ExecutionIntegrityError("Invalid artifact quota");
  const owned = async (
    executor: DbExecutor,
    lease: ExecutionLease,
    allowed: ExecutionJobState[],
  ) => {
    validateLease(lease);
    const job = await createExecutionJobsDao(executor).lockById(lease, lease.jobId);
    const now = await nowAt(executor);
    if (!job || !leaseValid(job, lease, now)) throw new ExecutionLeaseLostError();
    if (!allowed.includes(job.state)) throw new ExecutionJobStateConflictError();

    return { job, now, prepared: await preparedFor(executor, job) };
  };
  const withLease = <T>(
    lease: ExecutionLease,
    allowed: ExecutionJobState[],
    operation: (executor: DbExecutor, context: Awaited<ReturnType<typeof owned>>) => Promise<T>,
    semanticChange = false,
    requireBudget = false,
  ): Promise<T> =>
    db.transaction(async (tx) => {
      const context = await owned(tx, lease, allowed);
      const result = await operation(tx, context);
      if (requireBudget) requireActiveBudget(context.job, await nowAt(tx));
      const fence = semanticChange
        ? await createExecutionJobsDao(tx).updateOwned(lease, ACTIVE, {}, true, requireBudget)
        : await createExecutionJobsDao(tx).assertOwned(lease, requireBudget);
      if (!fence) throw new ExecutionLeaseLostError();

      return result;
    });
  const readJob = async (identity: ExecutionIdentity, jobId: string) => {
    const job = await createExecutionJobsDao(db).findById(identity, jobId);
    if (!job) throw new ExecutionNotFoundError("Job");

    return job;
  };
  const claimLocked = async (
    executor: DbExecutor,
    job: ExecutionJobRecord | null,
    executorId: string,
    leaseMs: number,
  ) => {
    if (!job || job.state !== "queued" || job.executorId || job.startedAt) return null;
    await preparedFor(executor, job);
    const now = await nowAt(executor);
    const claimed = await createExecutionJobsDao(executor).claim(job, executorId, leaseMs, now);
    if (claimed)
      await createExecutionEventsDao(executor).create({
        jobId: job.id,
        type: "job_claimed",
        payload: { executorId, generation: claimed.generation },
      });

    return claimed;
  };

  return {
    async claimJob(
      identity: ExecutionIdentity,
      jobId: string,
      executorId: string,
      leaseMs: number,
    ) {
      ExecutionIdentifierSchema.parse(executorId);
      validateLeaseDuration(leaseMs);

      return db.transaction(async (tx) =>
        claimLocked(
          tx,
          await createExecutionJobsDao(tx).lockById(identity, jobId),
          executorId,
          leaseMs,
        ),
      );
    },
    async claimNext(workspaceId: string, executorId: string, leaseMs: number) {
      ExecutionIdentifierSchema.parse(workspaceId);
      ExecutionIdentifierSchema.parse(executorId);
      validateLeaseDuration(leaseMs);

      return db.transaction(async (tx) =>
        claimLocked(
          tx,
          await createExecutionJobsDao(tx).lockNext(workspaceId),
          executorId,
          leaseMs,
        ),
      );
    },
    async heartbeat(lease: ExecutionLease, leaseMs: number) {
      validateLease(lease);
      validateLeaseDuration(leaseMs);

      return db.transaction(async (tx) => {
        const dao = createExecutionJobsDao(tx);
        const job = await dao.lockById(lease, lease.jobId);
        const now = await nowAt(tx);
        if (
          !job ||
          !leaseValid(job, lease, now) ||
          !ACTIVE.includes(job.state as (typeof ACTIVE)[number])
        )
          return null;
        const timedOut = !job.stopReason && !job.cancelRequestedAt && budgetExpired(job, now);
        const refreshed = await dao.refresh(lease, leaseMs, timedOut, now);
        if (refreshed && timedOut)
          await createExecutionEventsDao(tx).create({
            jobId: job.id,
            type: "job_control",
            payload: { action: "timeout", state: "cancelling" },
          });

        return refreshed;
      });
    },
    async requestControl(
      principalInput: ExecutionPrincipal,
      jobId: string,
      action: "pause" | "resume" | "cancel",
    ) {
      const principal = controlPrincipal(principalInput);
      if (!["pause", "resume", "cancel"].includes(action))
        throw new ExecutionJobStateConflictError("Unknown control action");

      return db.transaction(async (tx) => {
        const dao = createExecutionJobsDao(tx);
        const job = await dao.lockById(principal, jobId);
        if (!job) throw new ExecutionNotFoundError("Job");
        if (terminalJob(job.state)) return job;
        const now = await nowAt(tx);
        if (action === "cancel") {
          if (job.state === "cancelling") return job;
          if (job.state === "queued") {
            await settleAttempts(tx, job, await preparedFor(tx, job), "cancelled", now);
            await createExecutionEventsDao(tx).create({
              jobId,
              type: "job_finished",
              payload: { state: "cancelled" },
            });

            return (await dao.updateLocked(job, {
              state: "cancelled",
              cancelRequestedAt: now,
              stopReason: "cancelled",
              finishedAt: now,
            }))!;
          }
          const cancelled = await dao.updateLocked(job, {
            state: "cancelling",
            cancelRequestedAt: job.cancelRequestedAt ?? now,
            stopReason: job.stopReason ?? "cancelled",
          });
          if (!cancelled) throw new ExecutionJobStateConflictError();
          await createExecutionEventsDao(tx).create({
            jobId,
            type: "job_control",
            payload: { action, state: cancelled.state },
          });

          return cancelled;
        }
        const lease = asLease(job);
        if (!leaseValid(job, lease, now)) throw new ExecutionLeaseLostError();
        if (job.state === "cancelling" || job.stopReason)
          throw new ExecutionJobStateConflictError();
        if (action === "pause" && (job.state === "pausing" || job.state === "paused")) return job;
        if (action === "resume" && job.state === "running") return job;
        if (job.state === "queued") throw new ExecutionJobStateConflictError();
        const patch = budgetExpired(job, now)
          ? timeoutPatch(job)
          : action === "pause"
            ? {
                state:
                  job.state === "waiting_for_input" ? ("paused" as const) : ("pausing" as const),
                pauseRequestedAt: now,
              }
            : resumePatch(job, now, await waitingWithoutAck(tx, job));
        const updated = await dao.updateOwned(lease, ACTIVE, patch, true, !budgetExpired(job, now));
        if (!updated) throw new ExecutionLeaseLostError();
        await createExecutionEventsDao(tx).create({
          jobId,
          type: "job_control",
          payload: { action, state: updated.state },
        });
        if (!budgetExpired(job, now)) requireActiveBudget(job, await nowAt(tx));

        return updated;
      });
    },
    async enterWaiting(lease: ExecutionLease, requested: "paused" | "waiting_for_input") {
      if (!["paused", "waiting_for_input"].includes(requested))
        throw new ExecutionJobStateConflictError();

      return withLease(
        lease,
        ["running", "pausing", "paused", "waiting_for_input"],
        async (tx, { job, now }) => {
          if (
            requested === "waiting_for_input" &&
            !job.pauseRequestedAt &&
            !(await waitingWithoutAck(tx, job))
          )
            return job;
          const attempts = await createExecutionNodeAttemptsDao(tx).listByJob(job.id);
          if (attempts.some((attempt) => attempt.state === "running"))
            throw new ExecutionJobStateConflictError(
              "Running attempts must converge before waiting",
            );
          if (requested === "paused" && !job.pauseRequestedAt)
            throw new ExecutionJobStateConflictError("Pause was not requested");
          const state = job.pauseRequestedAt ? "paused" : requested;
          if (job.state === state) return job;
          const activeRemainingMs = job.deadlineAt
            ? Math.max(0, job.deadlineAt.getTime() - now.getTime())
            : job.activeRemainingMs;
          const patch =
            !activeRemainingMs || !job.waitingRemainingMs || budgetExpired(job, now)
              ? timeoutPatch(job)
              : {
                  state,
                  activeRemainingMs,
                  deadlineAt: null,
                  waitingDeadlineAt:
                    job.waitingDeadlineAt ?? new Date(now.getTime() + job.waitingRemainingMs),
                };
          const updated = await createExecutionJobsDao(tx).updateOwned(
            lease,
            ACTIVE,
            patch,
            true,
            !budgetExpired(job, now),
          );
          if (!updated) throw new ExecutionLeaseLostError();
          await createExecutionEventsDao(tx).create({
            jobId: job.id,
            type: "job_control",
            payload: { action: "enter_waiting", state: updated.state },
          });

          return updated;
        },
        false,
        true,
      );
    },
    async acknowledgeCheckpoint(principalInput: ExecutionPrincipal, jobId: string, nodeId: string) {
      const principal = controlPrincipal(principalInput);

      return db.transaction(async (tx) => {
        const dao = createExecutionJobsDao(tx);
        const job = await dao.lockById(principal, jobId);
        if (!job) throw new ExecutionNotFoundError("Job");
        const now = await nowAt(tx);
        const lease = asLease(job);
        if (!leaseValid(job, lease, now)) throw new ExecutionLeaseLostError();
        if (job.stopReason || job.state === "cancelling")
          throw new ExecutionJobStateConflictError();
        requireActiveBudget(job, now);
        const prepared = await preparedFor(tx, job);
        if (!graphNode(prepared, nodeId).checkpoint)
          throw new ExecutionJobStateConflictError("Node has no checkpoint");
        const events = createExecutionEventsDao(tx);
        if (await events.findCheckpointAcknowledgement(jobId, nodeId)) return job;
        const nodeStates = await events.latestNodeStates(jobId);
        const state = nodeStates.find((event) => event.nodeId === nodeId)?.payload["state"];
        if (state !== "waiting_for_input")
          throw new ExecutionJobStateConflictError("Checkpoint is not waiting");
        await events.create({
          jobId,
          nodeId,
          type: "checkpoint_acknowledged",
          payload: { subjectId: principal.subjectId },
        });
        const patch =
          job.state === "waiting_for_input" && !job.pauseRequestedAt
            ? resumePatch(job, now, await waitingWithoutAck(tx, job))
            : {};
        const updated = await dao.updateOwned(lease, ACTIVE, patch, true, true);
        if (!updated) throw new ExecutionLeaseLostError();

        return updated;
      });
    },
    async hasCheckpointAcknowledgement(lease: ExecutionLease, nodeId: string) {
      return db.transaction(async (tx) => {
        const { prepared } = await owned(tx, lease, ACTIVE);
        graphNode(prepared, nodeId);

        return Boolean(
          await createExecutionEventsDao(tx).findCheckpointAcknowledgement(lease.jobId, nodeId),
        );
      });
    },
    async startAttempt(lease: ExecutionLease, data: ExecutionAttemptStart) {
      return withLease(
        lease,
        ["running"],
        async (tx, { job, now, prepared }) => {
          requireActiveBudget(job, now);
          if (job.pauseRequestedAt || job.stopReason || job.cancelRequestedAt)
            throw new ExecutionJobStateConflictError();
          const node = graphNode(prepared, data.nodeId);
          const iteration = data.iteration ?? 1;
          if (
            !Number.isSafeInteger(data.attemptNumber) ||
            data.attemptNumber < 1 ||
            data.attemptNumber > node.retry.maxAttempts ||
            !Number.isSafeInteger(iteration) ||
            iteration < 1 ||
            iteration > (node.loop?.maxIterations ?? 1)
          )
            throw new ExecutionIntegrityError(
              "Attempt counters exceed the prepared retry/loop policy",
            );
          const dao = createExecutionNodeAttemptsDao(tx);
          const previous = latestAttempts(await dao.listByJob(job.id)).get(node.id);
          if (
            previous &&
            (!terminalAttempt(previous.state) ||
              iteration < previous.iteration ||
              (iteration === previous.iteration && data.attemptNumber <= previous.attemptNumber))
          )
            throw new ExecutionJobStateConflictError(
              "A newer or unfinished attempt already exists",
            );
          const id = ExecutionIdentifierSchema.parse(data.id ?? randomUUID());
          const inputs = ensureKnownPorts(prepared, node.id, data.inputs ?? {}, "inputPorts");
          const attempt = await dao.create({
            id,
            jobId: job.id,
            nodeId: node.id,
            attemptNumber: data.attemptNumber,
            iteration,
            inputs,
            state: "running",
            agentRunId: data.agentRunId ?? null,
            startedAt: now,
          });
          await persistNodeState(tx, job.id, node.id, "running", {
            attemptId: id,
            iteration,
            attemptNumber: data.attemptNumber,
          });

          return attempt;
        },
        true,
        true,
      );
    },
    async finishAttempt(lease: ExecutionLease, attemptId: string, patch: ExecutionAttemptFinish) {
      const state = ExecutionNodeStateSchema.parse(patch.state);
      if (!terminalAttempt(state))
        throw new ExecutionIntegrityError("Attempt completion requires a terminal state");

      return withLease(
        lease,
        ACTIVE,
        async (tx, { job, now, prepared }) => {
          const dao = createExecutionNodeAttemptsDao(tx);
          const attempt = await dao.findById(job.id, attemptId);
          if (!attempt) throw new ExecutionNotFoundError("Node attempt");
          graphNode(prepared, attempt.nodeId);
          const outputs =
            patch.outputs === undefined
              ? undefined
              : ensureKnownPorts(prepared, attempt.nodeId, patch.outputs, "outputPorts");
          const error =
            patch.error === undefined ? undefined : ExecutionErrorSchema.parse(patch.error);
          if (terminalAttempt(attempt.state)) {
            if (
              attempt.state !== state ||
              (outputs !== undefined &&
                hashExecutionJson(outputs) !== hashExecutionJson(attempt.outputs)) ||
              (error !== undefined && hashExecutionJson(error) !== hashExecutionJson(attempt.error))
            )
              throw new ExecutionJobStateConflictError("Attempt terminal state is immutable");

            return attempt;
          }
          const updated = await dao.transition(job.id, attemptId, ATTEMPT_ACTIVE, {
            state,
            ...(outputs === undefined ? {} : { outputs }),
            ...(error === undefined ? {} : { error }),
            ...(patch.agentRunId === undefined
              ? {}
              : { agentRunId: ExecutionIdentifierSchema.parse(patch.agentRunId) }),
            finishedAt: now,
          });
          if (!updated) throw new ExecutionJobStateConflictError();
          await persistNodeState(tx, job.id, attempt.nodeId, state, { attemptId });

          return updated;
        },
        true,
      );
    },
    async recordNodeState(
      lease: ExecutionLease,
      nodeId: string,
      input: ExecutionNodeState,
      payload: ExecutionJsonObject = {},
    ) {
      const state = ExecutionNodeStateSchema.parse(input);

      return withLease(
        lease,
        ACTIVE,
        async (tx, { job, prepared }) => {
          graphNode(prepared, nodeId);

          return persistNodeState(
            tx,
            job.id,
            nodeId,
            state,
            ExecutionJsonObjectSchema.parse(payload),
          );
        },
        true,
      );
    },
    async appendEvent(lease: ExecutionLease, data: ExecutionEventAppend) {
      const type = ExecutionIdentifierSchema.parse(data.type);
      if (RESERVED_EVENTS.has(type))
        throw new ExecutionIntegrityError("Use the semantic event operation for this event type");
      const payload = ExecutionJsonObjectSchema.parse(data.payload);

      return withLease(lease, ACTIVE, async (tx, { job, prepared }) => {
        const runtimeEventCount = job.runtimeEventCount + 1;
        const runtimeEventBytes =
          job.runtimeEventBytes + new TextEncoder().encode(JSON.stringify(payload)).byteLength;
        if (runtimeEventCount > maxRuntimeEvents || runtimeEventBytes > maxRuntimeEventBytes)
          throw new ExecutionIntegrityError("Job runtime event quota exceeded");
        const attempt = data.attemptId
          ? await createExecutionNodeAttemptsDao(tx).findById(job.id, data.attemptId)
          : null;
        if (data.attemptId && (!attempt || (data.nodeId && attempt.nodeId !== data.nodeId)))
          throw new ExecutionNotFoundError("Event attempt");
        const nodeId = attempt?.nodeId ?? data.nodeId ?? null;
        if (nodeId) graphNode(prepared, nodeId);
        if (
          !(await createExecutionJobsDao(tx).updateOwned(
            lease,
            ACTIVE,
            { runtimeEventCount, runtimeEventBytes },
            false,
          ))
        )
          throw new ExecutionLeaseLostError();

        return createExecutionEventsDao(tx).create({
          jobId: job.id,
          nodeId,
          attemptId: data.attemptId ?? null,
          type,
          payload,
        });
      });
    },
    async registerArtifact(lease: ExecutionLease, data: ExecutionArtifactRegistration) {
      const metadata = ExecutionArtifactSchema.parse(data.metadata);
      if (
        !["staged", "validated"].includes(metadata.state) ||
        !data.storageKey ||
        data.storageKey.length > 1024
      )
        throw new ExecutionIntegrityError(
          "Artifacts must be staged or validated before Job publication",
        );

      return withLease(
        lease,
        ["running", "pausing"],
        async (tx, { job, now, prepared }) => {
          requireActiveBudget(job, now);
          if (job.stopReason || job.cancelRequestedAt || metadata.jobId !== job.id)
            throw new ExecutionJobStateConflictError(
              "Artifact does not belong to active execution",
            );
          const operation = nodeOperation(prepared, metadata.nodeId);
          if (
            !operation.outputPorts.some(
              (port) => port.id === metadata.portId && port.valueType === "artifact",
            )
          )
            throw new ExecutionIntegrityError("Artifact port is not a declared output");
          const attempt = await createExecutionNodeAttemptsDao(tx).findById(
            job.id,
            metadata.attemptId,
          );
          const latest = latestAttempts(
            await createExecutionNodeAttemptsDao(tx).listByJob(job.id),
          ).get(metadata.nodeId);
          if (
            !attempt ||
            attempt.nodeId !== metadata.nodeId ||
            latest?.id !== attempt.id ||
            !["running", "succeeded"].includes(attempt.state)
          )
            throw new ExecutionJobStateConflictError(
              "Artifact is not from the current successful or running attempt",
            );
          const dao = createExecutionArtifactsDao(tx);
          const existing = await dao.findById(metadata.artifactId);
          if (existing) {
            if (
              existing.jobId !== job.id ||
              existing.storageKey !== data.storageKey ||
              hashExecutionJson({ ...existing.metadata, state: metadata.state }) !==
                hashExecutionJson(metadata) ||
              (existing.state !== metadata.state &&
                !(existing.state === "staged" && metadata.state === "validated"))
            )
              throw new ExecutionIntegrityError(
                "Artifact registration is immutable apart from validation",
              );
            if (existing.state === metadata.state) return existing;

            return (await dao.updateMetadata(existing.artifactId, job.id, metadata))!;
          }

          const registered = await dao.listByJob(job.id);
          if (
            registered.length >= maxJobArtifacts ||
            registered.reduce(
              (bytes, row) => bytes + ExecutionArtifactSchema.parse(row.metadata).sizeBytes,
              metadata.sizeBytes,
            ) > maxJobArtifactBytes
          )
            throw new ExecutionIntegrityError("Job artifact quota exceeded");

          return dao.create({
            artifactId: metadata.artifactId,
            jobId: job.id,
            nodeId: metadata.nodeId,
            portId: metadata.portId,
            attemptId: metadata.attemptId,
            metadata,
            storageKey: data.storageKey,
            state: metadata.state,
          });
        },
        true,
      );
    },
    async assertJobLease(lease: ExecutionLease) {
      return withLease(
        lease,
        ["running", "pausing", "paused", "waiting_for_input"],
        async (_tx, { job, now }) => {
          requireActiveBudget(job, now);
          if (job.stopReason || job.cancelRequestedAt) throw new ExecutionJobStateConflictError();
        },
        false,
        true,
      );
    },
    async assertArtifactLease(context: {
      lease: ExecutionLease;
      nodeId: string;
      attemptId: string;
    }) {
      return withLease(
        context.lease,
        ["running", "pausing"],
        async (tx, { job, now, prepared }) => {
          requireActiveBudget(job, now);
          graphNode(prepared, context.nodeId);
          if (job.stopReason || job.cancelRequestedAt) throw new ExecutionJobStateConflictError();
          const attempt = await createExecutionNodeAttemptsDao(tx).findById(
            job.id,
            context.attemptId,
          );
          if (!attempt || attempt.nodeId !== context.nodeId || attempt.state !== "running")
            throw new ExecutionJobStateConflictError("Artifact requires an active owning attempt");
        },
        false,
        true,
      );
    },
    async getProducedArtifact(
      identity: ExecutionIdentity,
      artifactId: string,
      access: { lease?: ExecutionLease } = {},
    ) {
      return db.transaction(async (tx) => {
        const row = await createExecutionArtifactsDao(tx).findById(artifactId);
        if (!row) return null;
        const sourceJob = await createExecutionJobsDao(tx).findById(identity, row.jobId);
        if (!sourceJob) return null;
        if (row.state === "published" && sourceJob.state === "succeeded")
          return { ...row, metadata: ExecutionArtifactSchema.parse(row.metadata) };
        if (
          !access.lease ||
          row.jobId !== access.lease.jobId ||
          row.state !== "validated" ||
          identity.workspaceId !== access.lease.workspaceId ||
          identity.subjectId !== access.lease.subjectId
        )
          return null;
        const { job, now } = await owned(tx, access.lease, [
          "running",
          "pausing",
          "paused",
          "waiting_for_input",
        ]);
        requireActiveBudget(job, now);
        if (job.stopReason || job.cancelRequestedAt) throw new ExecutionJobStateConflictError();
        const latest = latestAttempts(
          await createExecutionNodeAttemptsDao(tx).listByJob(job.id),
        ).get(row.nodeId);
        if (latest?.id !== row.attemptId || !["running", "succeeded"].includes(latest.state))
          return null;
        if (!(await createExecutionJobsDao(tx).assertOwned(access.lease, true)))
          throw new ExecutionLeaseLostError();

        return { ...row, metadata: ExecutionArtifactSchema.parse(row.metadata) };
      });
    },
    async getArtifact(identity: ExecutionIdentity, artifactId: string) {
      const row = await createExecutionArtifactsDao(db).findById(artifactId);
      if (!row || !(await createExecutionJobsDao(db).findById(identity, row.jobId))) return null;

      return { ...row, metadata: ExecutionArtifactSchema.parse(row.metadata) };
    },
    async listArtifacts(identity: ExecutionIdentity, jobId: string, includeUnpublished = false) {
      await readJob(identity, jobId);
      const rows = await createExecutionArtifactsDao(db).listByJob(jobId);

      return rows
        .filter((row) => includeUnpublished || row.state === "published")
        .map((row) => ({ ...row, metadata: ExecutionArtifactSchema.parse(row.metadata) }));
    },
    async listJobs(identity: ExecutionIdentity) {
      return createExecutionJobsDao(db).list(identity);
    },
    async listJobSummaries(identity: ExecutionIdentity) {
      const jobs = await createExecutionJobsDao(db).list(identity);

      return Promise.all(jobs.map((job) => summaryFor(db, job)));
    },
    async getJobSummary(identity: ExecutionIdentity, jobId: string) {
      return summaryFor(db, await readJob(identity, jobId));
    },
    async listAttempts(identity: ExecutionIdentity, jobId: string) {
      await readJob(identity, jobId);

      return createExecutionNodeAttemptsDao(db).listByJob(jobId);
    },
    async getEvents(identity: ExecutionIdentity, jobId: string, afterSequence = 0, limit = 500) {
      if (
        !Number.isSafeInteger(afterSequence) ||
        afterSequence < 0 ||
        !Number.isSafeInteger(limit) ||
        limit < 1 ||
        limit > 1000
      )
        throw new ExecutionIntegrityError("Invalid event page bounds");
      await readJob(identity, jobId);

      return createExecutionEventsDao(db).listByJob(jobId, afterSequence, limit);
    },
    async finishJob(lease: ExecutionLease, input: ExecutionJobFinish) {
      const requested = ExecutionTerminalJobStateSchema.parse(input.state);
      const outputs = ExecutionPortValuesSchema.parse(input.outputs ?? {});
      const error = input.error === undefined ? null : ExecutionErrorSchema.parse(input.error);
      const warnings = ExecutionWarningsSchema.parse(input.warnings ?? []);

      return db.transaction(async (tx) => {
        const { job, now, prepared } = await owned(tx, lease, ACTIVE);
        const finalNodeEvents = await createExecutionEventsDao(tx).latestNodeStates(job.id);
        const finalNodeStates = new Map(
          finalNodeEvents.map((event) => [event.nodeId, event.payload["state"]]),
        );
        if (requested === "succeeded") {
          if (
            job.state !== "running" ||
            job.stopReason ||
            job.cancelRequestedAt ||
            job.pauseRequestedAt
          )
            throw new ExecutionJobStateConflictError(
              "Cannot succeed after a stop or pause decision",
            );
          requireActiveBudget(job, now);
          for (const node of prepared.pipeline.graph.nodes) {
            const state = finalNodeStates.get(node.id);
            if (
              state !== "succeeded" &&
              state !== "skipped" &&
              !(node.failurePolicy === "best_effort" && state === "failed")
            )
              throw new ExecutionJobStateConflictError(
                "Cannot succeed with an unfinished or failed required node",
              );
          }
        }
        const state =
          requested === "interrupted"
            ? requested
            : (job.stopReason ?? (budgetExpired(job, now) ? "timed_out" : requested));
        const attempts = await settleAttempts(tx, job, prepared, state, now);
        if (!(await createExecutionPipelineRunsDao(tx).setOutputs(job.id, outputs)))
          throw new ExecutionIntegrityError("Job has no PipelineRun result record");
        if (state === "succeeded") {
          const latest = latestAttempts(attempts);
          const dao = createExecutionArtifactsDao(tx);
          for (const row of await dao.listByJob(job.id)) {
            const attempt = latest.get(row.nodeId);
            if (
              row.state === "validated" &&
              attempt?.id === row.attemptId &&
              attempt.state === "succeeded" &&
              finalNodeStates.get(row.nodeId) === "succeeded"
            ) {
              const metadata = ExecutionArtifactSchema.parse({
                ...row.metadata,
                state: "published",
              });
              if (!(await dao.updateMetadata(row.artifactId, job.id, metadata)))
                throw new ExecutionIntegrityError("Artifact disappeared during publication");
            }
          }
        }
        await createExecutionEventsDao(tx).create({
          jobId: job.id,
          type: "job_finished",
          payload: { state, warnings },
        });
        const updated = await createExecutionJobsDao(tx).updateOwned(
          lease,
          ACTIVE,
          {
            state,
            error,
            warnings,
            finishedAt: now,
            executorId: null,
            leaseExpiresAt: null,
            heartbeatAt: null,
            deadlineAt: null,
            waitingDeadlineAt: null,
            stopReason:
              job.stopReason ??
              (state === "timed_out" ? "timed_out" : state === "cancelled" ? "cancelled" : null),
          },
          true,
          state === "succeeded",
        );
        if (!updated) throw new ExecutionLeaseLostError();

        return updated;
      });
    },
    async recoverExpired(workspaceId: string) {
      ExecutionIdentifierSchema.parse(workspaceId);

      return db.transaction(async (tx) => {
        const dao = createExecutionJobsDao(tx);
        const recovered: ExecutionJobRecord[] = [];
        for (const job of await dao.lockExpired(workspaceId)) {
          const now = await nowAt(tx);
          const prepared = await preparedFor(tx, job);
          await settleAttempts(tx, job, prepared, "interrupted", now);
          await createExecutionEventsDao(tx).create({
            jobId: job.id,
            type: "job_finished",
            payload: { state: "interrupted", reason: "executor_lease_expired" },
          });
          const updated = await dao.updateLocked(job, {
            state: "interrupted",
            finishedAt: now,
            executorId: null,
            leaseExpiresAt: null,
            heartbeatAt: null,
            deadlineAt: null,
            waitingDeadlineAt: null,
            error: {
              code: "EXECUTOR_LEASE_EXPIRED",
              message: "Executor ownership expired; this Job will not be automatically replayed",
              retryable: false,
              stage: "execution",
              jobId: job.id,
            },
          });
          if (!updated) throw new ExecutionJobStateConflictError();
          recovered.push(updated);
        }

        return recovered;
      });
    },
  };
};
export type ExecutionJobRepository = ReturnType<typeof createExecutionJobRepository>;
