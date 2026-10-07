import type { AgentRunEventEnvelope } from "@repo/schemas";

import type { AgentRunsServiceBindings } from "../../contracts";
export const createGetEventsMethod = (
  serviceBindings: Pick<AgentRunsServiceBindings, "runsDao" | "eventsDao">,
) =>
  ({
    async getEvents(runId: string, after = 0, limit = 500): Promise<AgentRunEventEnvelope[]> {
      const run = await serviceBindings.runsDao.findById(runId);
      if (!run) throw new Error(`Agent run not found: ${runId}`);
      const boundedLimit = Math.max(1, Math.min(Math.floor(limit), 2000));
      const events = await serviceBindings.eventsDao.findManyByRunIdAfter(
        runId,
        after,
        boundedLimit,
      );

      return events.map((event) => ({
        runId,
        sequence: event.sequence,
        createdAt: event.createdAt.toISOString(),
        event: event.event,
      }));
    },
  }).getEvents;
