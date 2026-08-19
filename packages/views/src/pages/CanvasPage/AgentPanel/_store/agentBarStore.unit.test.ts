import { describe, expect, it } from "vitest";
import {
  countAnchorsByRef,
  countUnresolvedAnchors,
  createAgentBarStore,
  type AgentBarMessage,
} from "./agentBarStore";

const message = (id: string): AgentBarMessage => ({
  content: `message ${id}`,
  id,
  role: "user",
});

describe("createAgentBarStore", () => {
  it("isolates conversations by pipeline", () => {
    const storeA = createAgentBarStore("pipeline-a");
    const storeB = createAgentBarStore("pipeline-b");

    storeA.getState().addMessage(message("a1"));
    storeB.getState().addMessage(message("b1"));

    expect(storeA.getState().messages.map((item) => item.id)).toEqual(["a1"]);
    expect(storeB.getState().messages.map((item) => item.id)).toEqual(["b1"]);
  });

  it("replaces an optimistic message with the persisted copy", () => {
    const store = createAgentBarStore("pipeline-a");
    store.getState().addMessage(message("m1"));
    store.getState().addMessage({ ...message("m1"), content: "persisted" });

    expect(store.getState().messages).toEqual([
      expect.objectContaining({ id: "m1", content: "persisted" }),
    ]);
  });

  it("tracks idle to thinking to streaming to done transitions", () => {
    const store = createAgentBarStore("pipeline-a");

    store.getState().setConversationState("thinking");
    expect(store.getState().conversationState).toBe("thinking");

    store.getState().appendStreamingAssistantText("first");
    store.getState().appendStreamingAssistantText("second");
    store.getState().setConversationState("streaming");
    expect(store.getState().conversationState).toBe("streaming");
    expect(store.getState().streamingAssistantText).toBe("firstsecond");

    store.getState().setConversationState("done");
    expect(store.getState().conversationState).toBe("done");
  });

  it("resets session state without clearing conversation history", () => {
    const store = createAgentBarStore("pipeline-a");
    store.getState().addMessage(message("m1"));
    store.getState().setSession("session-1", "graph-1");
    store.getState().setProposalId("proposal-1");

    store.getState().resetSession();

    expect(store.getState()).toMatchObject({
      messages: [expect.objectContaining({ id: "m1" })],
      proposalId: null,
      sessionGraphSignature: null,
      sessionId: null,
    });
  });

  it("counts and resolves referenced canvas anchors", () => {
    const store = createAgentBarStore("pipeline-a");
    store.getState().addMessage({
      ...message("m1"),
      metadata: { referencedNodeIds: ["node-1", "node-2"] },
    });
    store.getState().addMessage({
      ...message("m2"),
      metadata: { referencedNodeIds: ["node-1"] },
    });

    expect(countUnresolvedAnchors(store.getState().messages, "node-1")).toBe(2);
    expect(countAnchorsByRef(store.getState().messages)).toEqual({ "node-1": 2, "node-2": 1 });

    store.getState().resolveMessage("m1");

    expect(countUnresolvedAnchors(store.getState().messages, "node-1")).toBe(1);
    expect(countAnchorsByRef(store.getState().messages)).toEqual({ "node-1": 1 });
  });
});
