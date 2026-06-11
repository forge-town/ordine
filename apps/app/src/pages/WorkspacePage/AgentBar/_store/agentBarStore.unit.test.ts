import { describe, expect, it } from "vitest";
import { countUnresolvedAnchors, useAgentBarStore, type AgentBarMessage } from "./agentBarStore";

const anchored = (id: string, refId: string, resolved = false): AgentBarMessage => ({
  content: `message ${id}`,
  id,
  metadata: { referencedNodeIds: [refId], resolved },
  role: "user",
});

describe("agentBarStore anchors", () => {
  it("counts only unresolved anchored messages for a ref", () => {
    const messages = [
      anchored("m1", "node-a"),
      anchored("m2", "node-a", true),
      anchored("m3", "node-b"),
      { content: "thinking", id: "m4", isThinking: true, metadata: { referencedNodeIds: ["node-a"] }, role: "assistant" as const },
    ];

    expect(countUnresolvedAnchors(messages, "node-a")).toBe(1);
    expect(countUnresolvedAnchors(messages, "node-b")).toBe(1);
    expect(countUnresolvedAnchors(messages, "node-c")).toBe(0);
  });

  it("resolves a message in place", () => {
    useAgentBarStore.getState().resetAgentBar();
    useAgentBarStore.getState().addMessage(anchored("m1", "node-a"));

    useAgentBarStore.getState().resolveMessage("m1");

    expect(useAgentBarStore.getState().messages[0]?.metadata?.resolved).toBe(true);
    expect(countUnresolvedAnchors(useAgentBarStore.getState().messages, "node-a")).toBe(0);
  });
});
