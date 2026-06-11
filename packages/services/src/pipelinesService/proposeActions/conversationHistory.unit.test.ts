import { describe, expect, it } from "vitest";
import {
  buildHistoryBlock,
  windowConversationHistory,
  type ProposeHistoryMessage,
} from "./conversationHistory";

const message = (overrides: Partial<ProposeHistoryMessage> = {}): ProposeHistoryMessage => ({
  content: "hello",
  hasProposal: false,
  role: "user",
  ...overrides,
});

describe("windowConversationHistory", () => {
  it("keeps at most the 20 most recent messages", () => {
    const messages = Array.from({ length: 30 }, (_, index) =>
      message({ content: `msg-${index}` }),
    );

    const windowed = windowConversationHistory(messages);

    expect(windowed).toHaveLength(20);
    expect(windowed[0]?.content).toBe("msg-10");
    expect(windowed.at(-1)?.content).toBe("msg-29");
  });

  it("truncates long messages to 500 chars plus ellipsis", () => {
    const windowed = windowConversationHistory([message({ content: "x".repeat(900) })]);

    expect(windowed[0]?.content).toHaveLength(501);
    expect(windowed[0]?.content.endsWith("…")).toBe(true);
  });

  it("drops the oldest messages when the total budget is exceeded", () => {
    const messages = Array.from({ length: 20 }, (_, index) =>
      message({ content: `${index}-${"y".repeat(499)}` }),
    );

    const windowed = windowConversationHistory(messages);
    const total = windowed.reduce((sum, item) => sum + item.content.length, 0);

    expect(total).toBeLessThanOrEqual(8000);
    expect(windowed.at(-1)?.content.startsWith("19-")).toBe(true);
    expect(windowed.length).toBeLessThan(20);
  });
});

describe("buildHistoryBlock", () => {
  it("returns nothing for an empty conversation", () => {
    expect(buildHistoryBlock([])).toEqual([]);
  });

  it("formats roles, proposal markers, and keeps oldest-first order", () => {
    const block = buildHistoryBlock([
      message({ content: "build a quiz pipeline" }),
      message({ content: "I drafted a proposal.", hasProposal: true, role: "agent" }),
    ]);

    expect(block[0]).toBe("=== CONVERSATION HISTORY (oldest first) ===");
    const userLine = block.find((line) => line.startsWith("[user]"));
    const agentLine = block.find((line) => line.startsWith("[assistant]"));
    expect(userLine).toBe("[user]: build a quiz pipeline");
    expect(agentLine).toBe("[assistant] (included a graph proposal): I drafted a proposal.");
    expect(block.indexOf(userLine!)).toBeLessThan(block.indexOf(agentLine!));
  });
});
