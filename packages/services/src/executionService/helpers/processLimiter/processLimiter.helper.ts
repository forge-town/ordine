type Waiter = ProcessLimiterWaiter;

import type { ProcessLimiterWaiter, ExecutionProcessLimiterBindings } from "../../contracts";

import { createProcessLimiterPumpHelper } from "../processLimiterPump";
import { createProcessLimiterSnapshotMethod } from "../../methods/processLimiterSnapshot";
import { createProcessLimiterAcquireMethod } from "../../methods/processLimiterAcquire";
export const createExecutionProcessLimiter = (
  options: { maxProcesses?: number; maxPerRuntime?: number; maxQueued?: number } = {},
) => {
  const serviceBindings: ExecutionProcessLimiterBindings = {
    get options(): ExecutionProcessLimiterBindings["options"] {
      return options;
    },
    get maxProcesses(): ExecutionProcessLimiterBindings["maxProcesses"] {
      return maxProcesses;
    },
    get maxPerRuntime(): ExecutionProcessLimiterBindings["maxPerRuntime"] {
      return maxPerRuntime;
    },
    get maxQueued(): ExecutionProcessLimiterBindings["maxQueued"] {
      return maxQueued;
    },
    get state(): ExecutionProcessLimiterBindings["state"] {
      return state;
    },
    get counts(): ExecutionProcessLimiterBindings["counts"] {
      return counts;
    },
    get queue(): ExecutionProcessLimiterBindings["queue"] {
      return queue;
    },
    get pump(): ExecutionProcessLimiterBindings["pump"] {
      return pump;
    },
  };

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
  const pump = createProcessLimiterPumpHelper(serviceBindings);

  return {
    snapshot: createProcessLimiterSnapshotMethod(serviceBindings),
    acquire: createProcessLimiterAcquireMethod(serviceBindings),
  };
};
