import {
  ExecutionEventSchema,
  ExecutionIdentifierSchema,
  type ExecutionPrincipal,
} from "@repo/schemas";

import type { ExecutionApiServiceBindings } from "../../contracts";
export const createGetEventsMethod =
  (serviceBindings: Pick<ExecutionApiServiceBindings, "scoped" | "deps">) =>
  (principal: ExecutionPrincipal, id: string, afterSequence = 0, limit = 500) =>
    (0, serviceBindings.scoped)(principal, "execution:read", async (identity) => {
      const events = await serviceBindings.deps.jobs.getEvents(
        identity,
        ExecutionIdentifierSchema.parse(id),
        afterSequence,
        limit,
      );

      return events.map((event) =>
        ExecutionEventSchema.parse({
          sequence: event.id,
          jobId: event.jobId,
          nodeId: event.nodeId,
          attemptId: event.attemptId,
          type: event.type,
          payload: event.payload,
          createdAt: event.createdAt.toISOString(),
        }),
      );
    });
