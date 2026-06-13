import { describe, expect, it } from "vitest";
import {
  countAnchorsByRef,
  countUnresolvedAnchors,
  createAgentBarStore,
  useAgentBarStore,
  type AgentBarMessage,
} from "./agentBarStore";

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
      {
        content: "thinking",
        id: "m4",
        isThinking: true,
        metadata: { referencedNodeIds: ["node-a"] },
        role: "assistant" as const,
      },
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

describe("countAnchorsByRef", () => {
  it("groups unresolved anchors by refId and skips resolved/thinking messages", () => {
    const messages: AgentBarMessage[] = [
      anchored("m1", "node-a"),
      anchored("m2", "node-a", true),
      anchored("m3", "node-b"),
      { ...anchored("m4", "node-b"), isThinking: true },
    ];

    expect(countAnchorsByRef(messages)).toEqual({ "node-a": 1, "node-b": 1 });
    expect(countAnchorsByRef([])).toEqual({});
  });
});

describe("createAgentBarStore — per-pipeline 隔离 (H2-03)", () => {
  it("两个 pipeline 的 store 互不串扰", () => {
    const storeA = createAgentBarStore("pipeline-a");
    const storeB = createAgentBarStore("pipeline-b");

    storeA.getState().addMessage(anchored("a1", "node-a"));
    expect(storeA.getState().messages).toHaveLength(1);
    // B 是独立实例，A 写入不影响 B。
    expect(storeB.getState().messages).toHaveLength(0);

    storeB.getState().addMessage(anchored("b1", "node-b"));
    // 切回 A：A 的消息仍在，未被 B 覆盖。
    expect(storeA.getState().messages.map((m) => m.id)).toEqual(["a1"]);
    expect(storeB.getState().messages.map((m) => m.id)).toEqual(["b1"]);
  });

  it("记录所属 pipelineId 供 Provider 检测切换重建", () => {
    expect(createAgentBarStore("p1").getState().pipelineId).toBe("p1");
    expect(createAgentBarStore().getState().pipelineId).toBeNull();
  });
});
