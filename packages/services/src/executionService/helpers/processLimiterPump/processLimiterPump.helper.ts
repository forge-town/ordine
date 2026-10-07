import { err, ok } from "neverthrow";

import { stopped } from "../../helpers/processLimiterStopped";

import type { ExecutionProcessLimiterBindings } from "../../contracts";
export const createProcessLimiterPumpHelper =
  (
    serviceBindings: Pick<
      ExecutionProcessLimiterBindings,
      "state" | "maxProcesses" | "queue" | "counts" | "maxPerRuntime" | "pump"
    >,
  ) =>
  () => {
    while (serviceBindings.state.active < serviceBindings.maxProcesses) {
      const index = serviceBindings.queue.findIndex(
        (waiter) => (serviceBindings.counts.get(waiter.key) ?? 0) < serviceBindings.maxPerRuntime,
      );
      if (index === -1) return;
      const waiter = serviceBindings.queue.splice(index, 1)[0]!;
      waiter.signal.removeEventListener("abort", waiter.cancel);
      if (waiter.signal.aborted) {
        waiter.resolve(err(stopped()));
        continue;
      }
      serviceBindings.state.active += 1;
      serviceBindings.counts.set(waiter.key, (serviceBindings.counts.get(waiter.key) ?? 0) + 1);
      const permit = { released: false };
      waiter.resolve(
        ok(() => {
          if (permit.released) return;
          permit.released = true;
          serviceBindings.state.active -= 1;
          const remaining = (serviceBindings.counts.get(waiter.key) ?? 1) - 1;
          if (remaining === 0) serviceBindings.counts.delete(waiter.key);
          else serviceBindings.counts.set(waiter.key, remaining);
          (0, serviceBindings.pump)();
        }),
      );
    }
  };
