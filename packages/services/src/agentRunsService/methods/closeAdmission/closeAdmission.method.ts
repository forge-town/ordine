import type { AgentRunsServiceBindings } from "../../contracts";
export const createCloseAdmissionMethod =
  (serviceBindings: Pick<AgentRunsServiceBindings, "admission" | "activeRuns">) => () => {
    serviceBindings.admission.open = false;
    for (const active of serviceBindings.activeRuns.values()) {
      if (active.controller.signal.aborted) continue;
      active.abortReason = "user_cancel";
      active.controller.abort();
    }
  };
