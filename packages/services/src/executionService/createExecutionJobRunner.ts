import { executePreparedRun, type OperationAttemptContext } from "@repo/pipeline-engine";
import { createExecutionProcessLimiter } from "./createExecutionProcessLimiter";
import {
  hashExecutionJson,
  type ExecutionJobRepository,
  type ExecutionLease,
  type ExecutionRepository,
} from "@repo/models";
import type { ExecutionJobRecord } from "@repo/db-schema";
import {
  type ExecutionError,
  type ExecutionPrincipal,
  type ExecutionPortValues,
  type ExecutionTerminalJobState,
} from "@repo/schemas";
import { type Result } from "neverthrow";
import type { createExecutionArtifactStore } from "../executionArtifacts";
import { createExecutionActors, type ExecutionActorContext } from "../executionActors";
import {
  ExecutionServiceFailure,
  executionFailure,
  executionServiceResult,
  toExecutionServiceError,
} from "./serviceResult";

type ArtifactStore = ReturnType<
  Awaited<ReturnType<typeof createExecutionArtifactStore>>["_unsafeUnwrap"]
>;
type Dependencies = {
  requests: Pick<ExecutionRepository, "getPrepared" | "getJob" | "getOperationRevision">;
  jobs: ExecutionJobRepository;
  artifactStore: ArtifactStore;
  executePrompt?: (
    context: ExecutionActorContext,
  ) => Promise<Result<ExecutionPortValues, ExecutionError>>;
  leaseMs?: number;
  heartbeatMs?: number;
  maxNodeConcurrency?: number;
  processLimits?: Parameters<typeof createExecutionProcessLimiter>[0];
};

const pauseBriefly = () => new Promise<void>((resolve) => setTimeout(resolve, 50));
const unwrap = <T>(result: Result<T, ExecutionError>): T => {
  if (result.isErr()) throw new ExecutionServiceFailure(result.error);

  return result.value;
};
const attemptState = (error: ExecutionError) =>
  /TERMINATION_FAILED|LEASE_LOST/u.test(error.code)
    ? ("interrupted" as const)
    : /TIMEOUT|TIMED_OUT|DEADLINE/u.test(error.code)
      ? ("timed_out" as const)
      : /CANCEL|ABORT/u.test(error.code)
        ? ("cancelled" as const)
        : ("failed" as const);

/** One claimed Job; database state owns controls, and the process runner owns actual cleanup. */
export const createExecutionJobRunner = (deps: Dependencies) => {
  const processes = createExecutionProcessLimiter(deps.processLimits);
  const leaseMs = deps.leaseMs ?? 30_000;
  const heartbeatMs = deps.heartbeatMs ?? 1000;
  if (!Number.isSafeInteger(heartbeatMs) || heartbeatMs < 50 || heartbeatMs * 3 >= leaseMs)
    throw new Error("Heartbeat must leave a safe lease margin");
  const actors = createExecutionActors({
    artifactStore: deps.artifactStore,
    limits: { maxDurationMs: 86_400_000 },
    onProcessResult: async (context, report) =>
      executionServiceResult(async () => {
        await deps.jobs.appendEvent(context.artifactContext.lease, {
          type: "process_result",
          nodeId: context.node.id,
          attemptId: context.attemptId,
          payload: report,
        });
      }),
  });

  return {
    run(claimed: ExecutionJobRecord, shutdownSignal: AbortSignal) {
      return executionServiceResult(async () => {
        if (!claimed.executorId || claimed.state !== "running")
          executionFailure("LEASE_REQUIRED", "Only an owned running Job can execute");
        const lease: ExecutionLease = {
          jobId: claimed.id,
          workspaceId: claimed.workspaceId,
          subjectId: claimed.subjectId,
          executorId: claimed.executorId,
          generation: claimed.generation,
        };
        const principal: ExecutionPrincipal = {
          workspaceId: claimed.workspaceId,
          subjectId: claimed.subjectId,
          scopes: ["execution:control"],
        };
        const controller = new AbortController();
        const activeAttempts = new Set<string>();
        const permits = new Map<string, () => void>();
        const checkpoints = new Set<string>();
        const state: {
          job: ExecutionJobRecord;
          done: boolean;
          heartbeat?: PromiseLike<void>;
          error?: ExecutionError;
          uncertain: boolean;
          stop?: PromiseLike<void>;
          leaseDeadline: number;
        } = {
          job: claimed,
          done: false,
          uncertain: false,
          leaseDeadline: performance.now() + leaseMs - heartbeatMs,
        };
        const abortWith = (error: ExecutionError) => {
          state.error ??= error;
          controller.abort(error);
        };
        const observe = (job: ExecutionJobRecord) => {
          state.job = job;
          if (job.state === "cancelling" || job.stopReason)
            controller.abort(job.stopReason ?? "cancelled");
        };
        const refresh = async () => {
          const job = await deps.requests.getJob(lease, lease.jobId);
          if (!job) executionFailure("NOT_FOUND", "Owned Job disappeared");
          observe(job);

          return job;
        };
        const convergeWaiting = async () => {
          const job = await refresh();
          if (controller.signal.aborted || activeAttempts.size > 0) return;
          if (job.state === "pausing") observe(await deps.jobs.enterWaiting(lease, "paused"));
          else if (checkpoints.size > 0 && job.state === "running")
            observe(await deps.jobs.enterWaiting(lease, "waiting_for_input"));
        };
        const awaitRunnable = async () => {
          for (;;) {
            const job = await refresh();
            if (controller.signal.aborted)
              executionFailure("CANCELLED", "Job execution stopped", undefined, "execution");
            if (job.state === "running") return;
            if (!["pausing", "paused", "waiting_for_input"].includes(job.state))
              executionFailure(
                "JOB_STATE_CONFLICT",
                "Job is no longer runnable",
                undefined,
                "execution",
              );
            await convergeWaiting();
            await pauseBriefly();
          }
        };
        const stop = () => {
          if (state.done || state.stop) return;
          state.stop = executionServiceResult(async () => {
            observe(await deps.jobs.requestControl(principal, lease.jobId, "cancel"));
          }).then((result) => {
            if (result.isErr()) {
              state.uncertain = true;
              abortWith(result.error);
            }
          });
        };
        shutdownSignal.addEventListener("abort", stop, { once: true });
        if (shutdownSignal.aborted) stop();
        const loseLease = () => {
          state.uncertain = true;
          abortWith({
            code: "EXECUTION_LEASE_LOST",
            message: "Lease renewal was not confirmed before the execution safety deadline",
            stage: "execution",
            retryable: false,
          });
        };
        const renewLease = () => {
          if (state.done || state.heartbeat) return;
          // Measure from request dispatch, not response arrival: a delayed DB reply
          // must never grant extra local execution time. PostgreSQL remains the lease authority.
          const sentAt = performance.now();
          state.heartbeat = executionServiceResult(async () => {
            const job = await deps.jobs.heartbeat(lease, leaseMs);
            if (!job)
              executionFailure(
                "EXECUTION_LEASE_LOST",
                "Executor lease is no longer valid",
                undefined,
                "execution",
              );
            observe(job);
          }).then((result) => {
            if (!state.done && result.isErr()) {
              state.uncertain = true;
              abortWith(result.error);
            } else if (!state.done) {
              const deadline = sentAt + leaseMs - heartbeatMs;
              if (performance.now() >= deadline) loseLease();
              else state.leaseDeadline = deadline;
            }
            state.heartbeat = undefined;
          });

          return state.heartbeat;
        };
        const timer = setInterval(() => {
          if (state.done) return;
          // This check continues even while the database renewal promise is blocked.
          if (performance.now() >= state.leaseDeadline) loseLease();
          renewLease();
        }, heartbeatMs);
        await renewLease();
        const body = await executionServiceResult(async () => {
          if (controller.signal.aborted)
            throw new ExecutionServiceFailure(
              state.error ?? {
                code: "CANCELLED",
                message: "Execution stopped before starting",
                stage: "execution",
                retryable: false,
              },
            );
          const prepared = await deps.requests.getPrepared(lease, claimed.preparedRunId);
          if (!prepared) executionFailure("NOT_FOUND", "PreparedRun is unavailable");
          const validateOperation = async (context: OperationAttemptContext) => {
            const current = await deps.requests.getOperationRevision(
              lease.workspaceId,
              context.operation.id,
              context.operation.revision,
            );
            if (!current || hashExecutionJson(current) !== hashExecutionJson(context.operation))
              executionFailure(
                "OPERATION_REVOKED",
                "Pinned Operation is no longer executable",
                context.node.id,
              );
          };
          const engine = await executePreparedRun({
            prepared,
            jobId: claimed.id,
            signal: controller.signal,
            maxConcurrency: deps.maxNodeConcurrency ?? 2,
            getArtifact: async (id) =>
              deps.artifactStore
                .metadataForJob({ lease, signal: controller.signal }, id)
                .mapErr(toExecutionServiceError),
            onNodeState: async (node, value) =>
              executionServiceResult(async () => {
                if (value === "running") {
                  await awaitRunnable();

                  return;
                }
                await deps.jobs.recordNodeState(lease, node.id, value);
              }),
            waitForCheckpoint: async (context) =>
              executionServiceResult(async () => {
                checkpoints.add(context.node.id);
                const waited = await executionServiceResult(async () => {
                  for (;;) {
                    await convergeWaiting();
                    if (controller.signal.aborted)
                      executionFailure(
                        "CANCELLED",
                        "Checkpoint wait stopped",
                        undefined,
                        "execution",
                      );
                    if (await deps.jobs.hasCheckpointAcknowledgement(lease, context.node.id)) break;
                    await pauseBriefly();
                  }
                });
                checkpoints.delete(context.node.id);
                unwrap(waited);
                await awaitRunnable();
              }),
            onAttemptStart: async (context) =>
              executionServiceResult(async () => {
                for (;;) {
                  await awaitRunnable();
                  const release =
                    context.operation.executor.kind === "builtin"
                      ? () => {}
                      : unwrap(
                          await processes.acquire(
                            context.operation.executor.kind === "agent"
                              ? `agent:${context.resolved.runtimeConfigId}`
                              : `script:${context.operation.executor.language}`,
                            context.signal,
                          ),
                        );
                  const refreshed = await executionServiceResult(refresh);
                  if (refreshed.isErr()) {
                    release();
                    throw new ExecutionServiceFailure(refreshed.error);
                  }
                  if (refreshed.value.state !== "running") {
                    release();
                    continue;
                  }
                  const verified = await executionServiceResult(() => validateOperation(context));
                  if (verified.isErr()) {
                    release();
                    throw new ExecutionServiceFailure(verified.error);
                  }
                  activeAttempts.add(context.attemptId);
                  const started = await executionServiceResult(() =>
                    deps.jobs.startAttempt(lease, {
                      id: context.attemptId,
                      nodeId: context.node.id,
                      iteration: context.iteration,
                      attemptNumber: context.attemptNumber,
                      inputs: context.inputs,
                      ...(context.operation.executor.kind === "agent"
                        ? { agentRunId: context.attemptId }
                        : {}),
                    }),
                  );
                  if (started.isOk()) {
                    permits.set(context.attemptId, release);

                    return;
                  }
                  release();
                  activeAttempts.delete(context.attemptId);
                  const job = await refresh();
                  if (
                    started.error.code !== "JOB_STATE_CONFLICT" ||
                    !["pausing", "paused", "waiting_for_input"].includes(job.state)
                  )
                    throw new ExecutionServiceFailure(started.error);
                }
              }),
            executeOperation: (context) => {
              const actorContext = {
                ...context,
                sharedContext: prepared.pipeline.sharedContext,
                credentialRefs: prepared.credentialRefs,
                artifactContext: {
                  lease,
                  nodeId: context.node.id,
                  attemptId: context.attemptId,
                  signal: context.signal,
                },
              };
              if (context.operation.executor.kind === "agent") {
                if (!deps.executePrompt)
                  return Promise.resolve(
                    executionServiceResult(async () =>
                      executionFailure(
                        "AGENT_ADAPTER_UNAVAILABLE",
                        "Prompt executor is not installed",
                        undefined,
                        "execution",
                      ),
                    ),
                  );

                return deps.executePrompt(actorContext);
              }

              return actors.execute(actorContext);
            },
            onAttemptEnd: async (context, result) =>
              executionServiceResult(async () => {
                if (result.isErr() && attemptState(result.error) === "interrupted")
                  state.uncertain = true;
                const ended = await executionServiceResult(() =>
                  deps.jobs.finishAttempt(
                    lease,
                    context.attemptId,
                    result.isOk()
                      ? { state: "succeeded", outputs: result.value }
                      : { state: attemptState(result.error), error: result.error },
                  ),
                );
                activeAttempts.delete(context.attemptId);
                permits.get(context.attemptId)?.();
                permits.delete(context.attemptId);
                unwrap(ended);
                await convergeWaiting();
              }),
          });
          if (engine.isOk()) await awaitRunnable();

          return engine;
        });
        const result = body.isErr() ? body : body.value;
        for (const release of permits.values()) release();
        permits.clear();
        const finish = await executionServiceResult(async () => {
          await state.stop;
          for (;;) {
            await refresh();
            const error = state.error ?? (result.isErr() ? result.error : undefined);
            const terminal: ExecutionTerminalJobState = state.uncertain
              ? "interrupted"
              : (state.job.stopReason ??
                (result.isOk()
                  ? "succeeded"
                  : error && attemptState(error) === "timed_out"
                    ? "timed_out"
                    : "failed"));
            const finished = await executionServiceResult(() =>
              deps.jobs.finishJob(lease, {
                state: terminal,
                ...(result.isOk()
                  ? { outputs: result.value.outputs, warnings: result.value.warnings }
                  : {}),
                ...(error ? { error } : {}),
              }),
            );
            if (finished.isOk()) return finished.value;
            const current = await refresh();
            if (
              terminal !== "succeeded" ||
              finished.error.code !== "JOB_STATE_CONFLICT" ||
              !["pausing", "paused", "waiting_for_input", "cancelling"].includes(current.state)
            )
              throw new ExecutionServiceFailure(finished.error);
            const ready = await executionServiceResult(awaitRunnable);
            if (ready.isErr() && !controller.signal.aborted)
              throw new ExecutionServiceFailure(ready.error);
          }
        });
        state.done = true;
        clearInterval(timer);
        shutdownSignal.removeEventListener("abort", stop);
        await state.heartbeat;

        return unwrap(finish);
      });
    },
  };
};
export type ExecutionJobRunner = ReturnType<typeof createExecutionJobRunner>;
