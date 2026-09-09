import type { ExecutionJobRepository, ExecutionRepository } from "@repo/models";
import type { ExecutionError, ExecutionPrincipal } from "@repo/schemas";
import type { ExecutionJobRunner } from "./createExecutionJobRunner";
import { executionFailure, executionServiceResult, ExecutionServiceFailure } from "./serviceResult";

export const createExecutionDispatcher = (deps: {
  principal: ExecutionPrincipal;
  instanceId: string;
  jobs: ExecutionJobRepository;
  requests: Pick<ExecutionRepository, "expirePendingApprovals">;
  runner: ExecutionJobRunner;
  maxJobs?: number;
  leaseMs?: number;
  pollMs?: number;
}) => {
  const maxJobs = deps.maxJobs ?? 2;
  const leaseMs = deps.leaseMs ?? 30_000;
  const pollMs = deps.pollMs ?? 250;
  if (
    !Number.isSafeInteger(maxJobs) ||
    maxJobs < 1 ||
    maxJobs > 16 ||
    !Number.isSafeInteger(pollMs) ||
    pollMs < 50
  )
    throw new Error("Invalid execution dispatcher limits");
  const active = new Map<string, { controller: AbortController; task: Promise<void> }>();
  const state: {
    accepting: boolean;
    started: boolean;
    tick?: Promise<void>;
    timer?: ReturnType<typeof setInterval>;
    lastError?: ExecutionError;
  } = { accepting: false, started: false };
  const poll = () => {
    if (!state.accepting || state.tick) return;
    state.tick = Promise.resolve(
      executionServiceResult(async () => {
        await deps.requests.expirePendingApprovals(deps.principal.workspaceId);
        await deps.jobs.recoverExpired(deps.principal.workspaceId);
        while (state.accepting && active.size < maxJobs) {
          const claimed = await deps.jobs.claimNext(
            deps.principal.workspaceId,
            deps.instanceId,
            leaseMs,
          );
          if (!claimed) break;
          const controller = new AbortController();
          const task = Promise.resolve(deps.runner.run(claimed, controller.signal)).then(
            (result) => {
              if (result.isErr()) state.lastError = result.error;
              active.delete(claimed.id);
            },
          );
          active.set(claimed.id, { controller, task });
          if (!state.accepting) controller.abort();
        }
      }),
    ).then((result) => {
      if (result.isErr()) state.lastError = result.error;
      state.tick = undefined;
    });
  };

  return {
    isAccepting: () => state.accepting,
    status: () => ({
      accepting: state.accepting,
      activeJobs: [...active.keys()],
      lastError: state.lastError,
    }),
    start: () =>
      executionServiceResult(async () => {
        if (state.started)
          executionFailure("DISPATCHER_ALREADY_STARTED", "Execution dispatcher is already started");
        await deps.jobs.recoverExpired(deps.principal.workspaceId);
        await deps.requests.expirePendingApprovals(deps.principal.workspaceId);
        state.started = true;
        state.accepting = true;
        state.timer = setInterval(poll, pollMs);
        poll();
      }),
    closeAdmission: () => {
      state.accepting = false;
    },
    stop: (timeoutMs = 30_000) =>
      executionServiceResult(async () => {
        state.accepting = false;
        if (state.timer) clearInterval(state.timer);
        await state.tick;
        const owned = await deps.jobs.listJobs(deps.principal);
        for (const job of owned) {
          if (job.state === "queued")
            await deps.jobs.requestControl(deps.principal, job.id, "cancel");
        }
        for (const job of active.values()) job.controller.abort();
        const timer: { id?: ReturnType<typeof setTimeout> } = {};
        const timed = new Promise<false>((resolve) => {
          timer.id = setTimeout(() => resolve(false), timeoutMs);
        });
        const settled = await Promise.race([
          Promise.all([...active.values()].map((job) => job.task)).then(() => true),
          timed,
        ]);
        if (timer.id) clearTimeout(timer.id);
        if (!settled)
          executionFailure(
            "EXECUTION_SHUTDOWN_INCOMPLETE",
            "Some execution processes did not confirm shutdown",
            undefined,
            "execution",
          );
        if (state.lastError && active.size > 0) throw new ExecutionServiceFailure(state.lastError);
      }),
  };
};
export type ExecutionDispatcher = ReturnType<typeof createExecutionDispatcher>;
