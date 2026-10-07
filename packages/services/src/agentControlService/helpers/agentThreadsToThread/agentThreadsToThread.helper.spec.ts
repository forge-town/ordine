import { describe, expect, it } from "vitest";
import { toThread } from "./agentThreadsToThread.helper";

describe("agentThreadsToThread", () => {
  it("retains the Agent Control contract boundary", () => {
    const result = toThread({
      id: "thread-1",
      title: "Thread",
      actor: "local-owner",
      threadStatus: "active",
      activeContext: null,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    } as never);
    expect(result).toMatchObject({
      id: "thread-1",
      status: "active",
      createdAt: new Date(0).toISOString(),
    });
  });
});
