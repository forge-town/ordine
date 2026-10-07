import {
  AgentControlEventSchema,
  type AgentControlEvent,
  type AgentRunEventEnvelope,
} from "@repo/schemas";

import type { AgentRunsServiceBindings } from "../../contracts";
export const createAppendControlEventMethod = (
  serviceBindings: Pick<AgentRunsServiceBindings, "getRunRecord" | "persistEvent">,
) =>
  ({
    async appendControlEvent(
      runId: string,
      input: AgentControlEvent,
    ): Promise<AgentRunEventEnvelope> {
      const run = await (0, serviceBindings.getRunRecord)(runId);
      if (!run.controlMode) throw new Error(`Agent run ${runId} is not an Agent Control run`);
      const event = AgentControlEventSchema.parse(input);
      if (event.runtime !== run.runtime) {
        throw new Error(`Agent Control event runtime does not match run ${runId}`);
      }

      return (0, serviceBindings.persistEvent)(runId, event);
    },
  }).appendControlEvent;
