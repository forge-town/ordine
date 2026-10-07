import { describe, expect, it, vi } from "vitest";
const findById = vi.fn().mockResolvedValue({ status: "completed" });
const createEvent = vi.fn();
vi.mock("@repo/models", () => ({
  createAgentRunsDao: () => ({ findById }),
  createAgentRunEventsDao: () => ({ create: createEvent }),
}));
import { createPersistEventHelper } from "./persistEvent.helper";
import { runtimeEvent } from "../runtimeEvent";
describe("persistEvent", () => {
  it("rejects post-terminal nonterminal writes before broadcasting or persisting", async () => {
    const broadcast = vi.fn();
    const persist = createPersistEventHelper({
      db: { transaction: async (operation: (db: unknown) => Promise<unknown>) => operation({}) },
      serializeRunPersistence: async (_id: string, operation: () => Promise<unknown>) =>
        operation(),
      broadcast,
    } as never);
    await expect(
      persist(
        "run-1",
        runtimeEvent("codex", {
          type: "diagnostic",
          level: "info",
          code: "INFO",
          message: "late event",
          retryable: false,
        }),
      ),
    ).rejects.toThrow("immutable terminal state");
    expect(createEvent).not.toHaveBeenCalled();
    expect(broadcast).not.toHaveBeenCalled();
  });
});
