import type { ExecutionJobRunnerBindings, OwnedJobExecutionBindings } from "../../contracts";
import { createJobRunnerRenewLeaseHelper } from "../../helpers/jobRunnerRenewLease";
import { createJobRunnerLoseLeaseHelper } from "../../helpers/jobRunnerLoseLease";
import { createJobRunnerStopHelper } from "../../helpers/jobRunnerStop";
import { createJobRunnerAwaitRunnableHelper } from "../../helpers/jobRunnerAwaitRunnable";
import { createJobRunnerConvergeWaitingHelper } from "../../helpers/jobRunnerConvergeWaiting";
import { createJobRunnerRefreshHelper } from "../../helpers/jobRunnerRefresh";
import { createJobRunnerObserveHelper } from "../../helpers/jobRunnerObserve";
import { createJobRunnerAbortWithHelper } from "../../helpers/jobRunnerAbortWith";
import { executePreparedRun, type OperationAttemptContext } from "@repo/pipeline-engine";

import { hashExecutionJson, type ExecutionLease } from "@repo/models";
import type { ExecutionJobRecord } from "@repo/db-schema";
import type { ExecutionError, ExecutionPrincipal, ExecutionTerminalJobState } from "@repo/schemas";

import {
  ExecutionServiceFailure,
  executionFailure,
  executionServiceResult,
  toExecutionServiceError,
} from "../../helpers/serviceResult";

import { pauseBriefly } from "../../helpers/jobRunnerPauseBriefly";
import { unwrap } from "../../helpers/jobRunnerUnwrap";
import { attemptState } from "../../helpers/jobRunnerAttemptState";

export const createJobRunnerRunMethod = (
  serviceBindings: Pick<
    ExecutionJobRunnerBindings,
    "leaseMs" | "heartbeatMs" | "deps" | "processes" | "actors"
  >,
) =>
  ({
    run(claimed: ExecutionJobRecord, shutdownSignal: AbortSignal) {
      return executionServiceResult(async () => {
        const ownedJobBindings: OwnedJobExecutionBindings = {
          get state(): OwnedJobExecutionBindings["state"] {
            return state;
          },
          get controller(): OwnedJobExecutionBindings["controller"] {
            return controller;
          },
          get lease(): OwnedJobExecutionBindings["lease"] {
            return lease;
          },
          get observe(): OwnedJobExecutionBindings["observe"] {
            return observe;
          },
          get refresh(): OwnedJobExecutionBindings["refresh"] {
            return refresh;
          },
          get activeAttempts(): OwnedJobExecutionBindings["activeAttempts"] {
            return activeAttempts;
          },
          get checkpoints(): OwnedJobExecutionBindings["checkpoints"] {
            return checkpoints;
          },
          get convergeWaiting(): OwnedJobExecutionBindings["convergeWaiting"] {
            return convergeWaiting;
          },
          get principal(): OwnedJobExecutionBindings["principal"] {
            return principal;
          },
          get abortWith(): OwnedJobExecutionBindings["abortWith"] {
            return abortWith;
          },
          get loseLease(): OwnedJobExecutionBindings["loseLease"] {
            return loseLease;
          },
        };

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
          leaseDeadline: performance.now() + serviceBindings.leaseMs - serviceBindings.heartbeatMs,
        };
        const abortWith = createJobRunnerAbortWithHelper(serviceBindings, ownedJobBindings);
        const observe = createJobRunnerObserveHelper(serviceBindings, ownedJobBindings);
        const refresh = createJobRunnerRefreshHelper(serviceBindings, ownedJobBindings);
        const convergeWaiting = createJobRunnerConvergeWaitingHelper(
          serviceBindings,
          ownedJobBindings,
        );
        const awaitRunnable = createJobRunnerAwaitRunnableHelper(serviceBindings, ownedJobBindings);
        const stop = createJobRunnerStopHelper(serviceBindings, ownedJobBindings);
        shutdownSignal.addEventListener("abort", stop, { once: true });
        if (shutdownSignal.aborted) stop();
        const loseLease = createJobRunnerLoseLeaseHelper(serviceBindings, ownedJobBindings);
        const renewLease = createJobRunnerRenewLeaseHelper(serviceBindings, ownedJobBindings);
        const timer = setInterval(() => {
          if (state.done) return;
          // This check continues even while the database renewal promise is blocked.
          if (performance.now() >= state.leaseDeadline) loseLease();
          renewLease();
        }, serviceBindings.heartbeatMs);
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
          const prepared = await serviceBindings.deps.requests.getPrepared(
            lease,
            claimed.preparedRunId,
          );
          if (!prepared) executionFailure("NOT_FOUND", "PreparedRun is unavailable");
          const validateOperation = async (context: OperationAttemptContext) => {
            const current = await serviceBindings.deps.requests.getOperationRevision(
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
            maxConcurrency: serviceBindings.deps.maxNodeConcurrency ?? 2,
            getArtifact: async (id) =>
              serviceBindings.deps.artifactStore
                .metadataForJob({ lease, signal: controller.signal }, id)
                .mapErr(toExecutionServiceError),
            onNodeState: async (node, value) =>
              executionServiceResult(async () => {
                if (value === "running") {
                  await awaitRunnable();

                  return;
                }
                await serviceBindings.deps.jobs.recordNodeState(lease, node.id, value);
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
                    if (
                      await serviceBindings.deps.jobs.hasCheckpointAcknowledgement(
                        lease,
                        context.node.id,
                      )
                    )
                      break;
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
                          await serviceBindings.processes.acquire(
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
                    serviceBindings.deps.jobs.startAttempt(lease, {
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
                if (!serviceBindings.deps.executePrompt)
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

                return serviceBindings.deps.executePrompt(actorContext);
              }

              return serviceBindings.actors.execute(actorContext);
            },
            onAttemptEnd: async (context, result) =>
              executionServiceResult(async () => {
                if (result.isErr() && attemptState(result.error) === "interrupted")
                  state.uncertain = true;
                const ended = await executionServiceResult(() =>
                  serviceBindings.deps.jobs.finishAttempt(
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
              serviceBindings.deps.jobs.finishJob(lease, {
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
  }).run;
