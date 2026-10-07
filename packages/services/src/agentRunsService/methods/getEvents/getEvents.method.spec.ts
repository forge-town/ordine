import { describe, expect, it, vi } from "vitest";
import { AgentRunEventSchema } from "@repo/schemas";
import { createGetEventsMethod } from "./getEvents.method";

describe("getEvents", () => {
  it("preserves the public Agent Run result and lifecycle boundary", async () => {
    const event = AgentRunEventSchema.parse({
      type: "status",
      phase: "running",
      runtime: "codex",
      timestamp: new Date(0).toISOString(),
    });
    const events = [{ sequence: 3, createdAt: new Date(0), event }];
    const findManyByRunIdAfter = vi.fn().mockResolvedValue(events);
    const read = createGetEventsMethod({
      runsDao: { findById: vi.fn().mockResolvedValue({ id: "run-1" }) },
      eventsDao: { findManyByRunIdAfter },
    } as never);
    expect(await read("run-1", 2, 99_999)).toEqual([
      {
        runId: "run-1",
        sequence: 3,
        createdAt: new Date(0).toISOString(),
        event,
      },
    ]);
    expect(findManyByRunIdAfter).toHaveBeenCalledWith("run-1", 2, 2000);
  });
});
