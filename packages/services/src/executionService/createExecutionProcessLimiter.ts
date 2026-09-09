import { err, ok, type Result } from "neverthrow";
import type { ExecutionError } from "@repo/schemas";

type Waiter = {
  key: string;
  signal: AbortSignal;
  resolve: (result: Result<() => void, ExecutionError>) => void;
  cancel: () => void;
};
const stopped = (): ExecutionError => ({
  code: "CANCELLED",
  message: "Process admission was cancelled",
  retryable: false,
  stage: "execution",
});

/** Fair bounded process admission shared by every Job in one application instance. */
export const createExecutionProcessLimiter = (
  options: { maxProcesses?: number; maxPerRuntime?: number; maxQueued?: number } = {},
) => {
  const maxProcesses = options.maxProcesses ?? 4;
  const maxPerRuntime = options.maxPerRuntime ?? 2;
  const maxQueued = options.maxQueued ?? 16;
  if (
    ![maxProcesses, maxPerRuntime, maxQueued].every(
      (value) => Number.isSafeInteger(value) && value > 0,
    )
  )
    throw new Error("Invalid process admission limits");
  const state = { active: 0 };
  const counts = new Map<string, number>();
  const queue: Waiter[] = [];
  const pump = () => {
    while (state.active < maxProcesses) {
      const index = queue.findIndex((waiter) => (counts.get(waiter.key) ?? 0) < maxPerRuntime);
      if (index === -1) return;
      const waiter = queue.splice(index, 1)[0]!;
      waiter.signal.removeEventListener("abort", waiter.cancel);
      if (waiter.signal.aborted) {
        waiter.resolve(err(stopped()));
        continue;
      }
      state.active += 1;
      counts.set(waiter.key, (counts.get(waiter.key) ?? 0) + 1);
      const permit = { released: false };
      waiter.resolve(
        ok(() => {
          if (permit.released) return;
          permit.released = true;
          state.active -= 1;
          const remaining = (counts.get(waiter.key) ?? 1) - 1;
          if (remaining === 0) counts.delete(waiter.key);
          else counts.set(waiter.key, remaining);
          pump();
        }),
      );
    }
  };

  return {
    snapshot: () => ({
      active: state.active,
      queued: queue.length,
      runtimes: Object.fromEntries(counts),
    }),
    acquire: (key: string, signal: AbortSignal): Promise<Result<() => void, ExecutionError>> => {
      if (signal.aborted) return Promise.resolve(err(stopped()));
      if (queue.length >= maxQueued)
        return Promise.resolve(
          err({
            code: "PROCESS_CAPACITY_EXCEEDED",
            message: "Process admission queue is full",
            retryable: true,
            stage: "execution",
          }),
        );

      return new Promise((resolve) => {
        const waiter: Waiter = {
          key,
          signal,
          resolve,
          cancel: () => {
            const index = queue.indexOf(waiter);
            if (index !== -1) queue.splice(index, 1);
            signal.removeEventListener("abort", waiter.cancel);
            resolve(err(stopped()));
            pump();
          },
        };
        queue.push(waiter);
        signal.addEventListener("abort", waiter.cancel, { once: true });
        if (signal.aborted) waiter.cancel();
        else pump();
      });
    },
  };
};
