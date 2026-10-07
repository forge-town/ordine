import type { AgentRunRequest } from "@repo/schemas";

import type { AgentRunTransientOptions, AgentRunTransientFactory } from "../../agentRuns.service";

import type { AgentRunsServiceBindings } from "../../contracts";
export const createStartMethod =
  (
    serviceBindings: Pick<
      AgentRunsServiceBindings,
      "admission" | "AdmissionClosedError" | "initializeRun" | "startingRuns"
    >,
  ) =>
  (
    input: AgentRunRequest,
    transientSource: AgentRunTransientOptions | AgentRunTransientFactory = {},
  ): Promise<{ runId: string }> => {
    if (!serviceBindings.admission.open)
      return Promise.reject(new serviceBindings.AdmissionClosedError());
    const pending = (0, serviceBindings.initializeRun)(input, transientSource);
    serviceBindings.startingRuns.add(pending);
    void pending.then(
      () => {
        serviceBindings.startingRuns.delete(pending);
      },
      () => {
        serviceBindings.startingRuns.delete(pending);
      },
    );

    return pending;
  };
