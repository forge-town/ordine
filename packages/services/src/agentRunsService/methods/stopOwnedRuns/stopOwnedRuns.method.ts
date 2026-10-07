import type { AgentRunsServiceBindings } from "../../contracts";
export const createStopOwnedRunsMethod = (
  serviceBindings: Pick<
    AgentRunsServiceBindings,
    "closeAdmission" | "executions" | "startingRuns" | "AdmissionClosedError"
  >,
) =>
  ({
    async stopOwnedRuns() {
      (0, serviceBindings.closeAdmission)();
      const draining = [...serviceBindings.executions.values()];
      const initialized = await Promise.allSettled(serviceBindings.startingRuns);
      const pending = [...new Set([...draining, ...serviceBindings.executions.values()])];
      const completed = await Promise.allSettled(pending);
      if (
        initialized.some(
          (result) =>
            result.status === "rejected" &&
            !(result.reason instanceof serviceBindings.AdmissionClosedError),
        ) ||
        completed.some((result) => result.status === "rejected")
      )
        throw new Error("An authoring Agent did not settle cleanly.");
    },
  }).stopOwnedRuns;
