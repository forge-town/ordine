import type { ExecutionJobRepository, ExecutionRepository } from "@repo/models";
import type { ExecutionError, ExecutionPrincipal } from "@repo/schemas";
import type { ExecutionJobRunner } from "../jobRunner";

export type ExecutionDispatcher = ReturnType<typeof createExecutionDispatcher>;
import type { ExecutionDispatcherBindings } from "../../contracts";

import { createDispatcherPollHelper } from "../dispatcherPoll";
import { createDispatcherIsAcceptingMethod } from "../../methods/dispatcherIsAccepting";
import { createDispatcherStatusMethod } from "../../methods/dispatcherStatus";
import { createDispatcherStartMethod } from "../../methods/dispatcherStart";
import { createDispatcherCloseAdmissionMethod } from "../../methods/dispatcherCloseAdmission";
import { createDispatcherStopMethod } from "../../methods/dispatcherStop";
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
  const serviceBindings: ExecutionDispatcherBindings = {
    get deps(): ExecutionDispatcherBindings["deps"] {
      return deps;
    },
    get maxJobs(): ExecutionDispatcherBindings["maxJobs"] {
      return maxJobs;
    },
    get leaseMs(): ExecutionDispatcherBindings["leaseMs"] {
      return leaseMs;
    },
    get pollMs(): ExecutionDispatcherBindings["pollMs"] {
      return pollMs;
    },
    get active(): ExecutionDispatcherBindings["active"] {
      return active;
    },
    get state(): ExecutionDispatcherBindings["state"] {
      return state;
    },
    get poll(): ExecutionDispatcherBindings["poll"] {
      return poll;
    },
  };

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
  const poll = createDispatcherPollHelper(serviceBindings);

  return {
    isAccepting: createDispatcherIsAcceptingMethod(serviceBindings),
    status: createDispatcherStatusMethod(serviceBindings),
    start: createDispatcherStartMethod(serviceBindings),
    closeAdmission: createDispatcherCloseAdmissionMethod(serviceBindings),
    stop: createDispatcherStopMethod(serviceBindings),
  };
};
