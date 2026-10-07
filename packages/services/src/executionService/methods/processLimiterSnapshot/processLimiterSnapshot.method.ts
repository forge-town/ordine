import type { ExecutionProcessLimiterBindings } from "../../contracts";
export const createProcessLimiterSnapshotMethod =
  (serviceBindings: Pick<ExecutionProcessLimiterBindings, "state" | "queue" | "counts">) => () => ({
    active: serviceBindings.state.active,
    queued: serviceBindings.queue.length,
    runtimes: Object.fromEntries(serviceBindings.counts),
  });
