import { err, type Result } from "neverthrow";
import type { ExecutionError } from "@repo/schemas";
import type {
  ProcessLimiterWaiter as Waiter,
  ExecutionProcessLimiterBindings,
} from "../../contracts";
import { stopped } from "../../helpers/processLimiterStopped";

export const createProcessLimiterAcquireMethod =
  (serviceBindings: Pick<ExecutionProcessLimiterBindings, "queue" | "maxQueued" | "pump">) =>
  (key: string, signal: AbortSignal): Promise<Result<() => void, ExecutionError>> => {
    if (signal.aborted) return Promise.resolve(err(stopped()));
    if (serviceBindings.queue.length >= serviceBindings.maxQueued)
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
          const index = serviceBindings.queue.indexOf(waiter);
          if (index !== -1) serviceBindings.queue.splice(index, 1);
          signal.removeEventListener("abort", waiter.cancel);
          resolve(err(stopped()));
          (0, serviceBindings.pump)();
        },
      };
      serviceBindings.queue.push(waiter);
      signal.addEventListener("abort", waiter.cancel, { once: true });
      if (signal.aborted) waiter.cancel();
      else (0, serviceBindings.pump)();
    });
  };
