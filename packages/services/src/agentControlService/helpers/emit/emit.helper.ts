import { AgentControlEventSchema, type AgentControlEvent } from "@repo/schemas";

import { canAppendControlRunEvent } from "../controlRunEvent/controlRunEvent.helper";

import type { AgentControlServiceBindings } from "../../contracts";
export const createEmitHelper =
  (serviceBindings: Pick<AgentControlServiceBindings, "options">) =>
  async (
    runId: string | null,
    payload: Record<string, unknown> & { type: AgentControlEvent["type"] },
  ): Promise<void> => {
    if (!runId || !serviceBindings.options.runEvents) return;
    const run = await serviceBindings.options.runEvents.getRun(runId);
    if (!run || !canAppendControlRunEvent(run)) return;
    const event = AgentControlEventSchema.parse({
      ...payload,
      runtime: run.runtime,
      timestamp: new Date().toISOString(),
    });
    await serviceBindings.options.runEvents.append(runId, event);
  };
