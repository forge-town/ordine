import { describe, expect, it, vi } from "vitest";
import { notifyCommittedChangeSet } from "./notifyCommittedChangeSet";
import type { AgentControlRunEventPort } from "./createAgentControlService";

describe("committed Change Set notification", () => {
  const notification = { type: "change_set_committed", changeSetId: "saved" } as const;
  it("does not append to a completed Agent stream after the user applies its proposal", async () => {
    const emit = vi.fn(async () => undefined);
    const events = {
      getRun: vi.fn(async () => ({ status: "completed", controlMode: true })),
    } as unknown as AgentControlRunEventPort;
    await notifyCommittedChangeSet(events, "run", notification, emit);
    expect(emit).not.toHaveBeenCalled();
  });
  it("keeps a durable Apply successful if the Agent finishes during notification", async () => {
    const emit = vi.fn(async () => {
      throw new Error("immutable terminal state");
    });
    const events = {
      getRun: vi.fn(async () => ({ status: "running", controlMode: true })),
    } as unknown as AgentControlRunEventPort;
    await expect(
      notifyCommittedChangeSet(events, "run", notification, emit),
    ).resolves.toBeUndefined();
    expect(emit).toHaveBeenCalledOnce();
  });
});
