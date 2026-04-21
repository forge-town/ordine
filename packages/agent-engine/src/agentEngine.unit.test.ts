import { describe, it, expect, vi } from "vitest";
import type { ClaudeStreamEvent } from "@repo/agent";

const fakeClaudeEvents: ClaudeStreamEvent[] = [
  {
    type: "result",
    subtype: "success",
    duration_ms: 1000,
    total_cost_usd: 0.01,
    num_turns: 1,
  },
];

vi.mock("@repo/agent", () => ({
  runClaude: vi.fn(async (opts: { onProgress?: (s: string) => Promise<void> }) => {
    await opts.onProgress?.("progress");
    return { text: "fake claude output", events: fakeClaudeEvents };
  }),
  runCodex: vi.fn(async (opts: { onProgress?: (s: string) => Promise<void> }) => {
    await opts.onProgress?.("progress");
    return "fake codex output";
  }),
}));

import { agentEngine } from "./agentEngine";

describe("agentEngine", () => {
  it("dispatches to runClaude for local-claude", async () => {
    const result = await agentEngine.run({
      agent: "local-claude",
      mode: "direct",
      systemPrompt: "You are a linter",
      userPrompt: "Check this code",
      cwd: "/tmp/test",
      allowedTools: ["Read"],
    });

    expect(result.text).toBe("fake claude output");
    expect(result.events).toEqual(fakeClaudeEvents);
  });

  it("dispatches to runCodex for codex", async () => {
    const result = await agentEngine.run({
      agent: "codex",
      mode: "direct",
      systemPrompt: "Analyze this",
      userPrompt: "Hello",
      cwd: "/tmp/test",
    });

    expect(result.text).toBe("fake codex output");
    expect(result.events).toEqual([]);
  });

  it("throws for unsupported agent backend", async () => {
    await expect(
      agentEngine.run({
        agent: "unknown" as "local-claude",
        mode: "direct",
        systemPrompt: "x",
        userPrompt: "y",
        cwd: "/tmp",
      }),
    ).rejects.toThrow("Unsupported agent backend");
  });

  it("forwards onProgress to the underlying driver", async () => {
    const onProgress = vi.fn();

    await agentEngine.run({
      agent: "local-claude",
      mode: "direct",
      systemPrompt: "x",
      userPrompt: "y",
      cwd: "/tmp",
      onProgress,
    });

    expect(onProgress).toHaveBeenCalled();
  });
});
