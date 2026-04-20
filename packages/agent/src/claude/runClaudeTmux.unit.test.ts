import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@repo/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

const tmuxMocks = vi.hoisted(() => ({
  runInTmux:
    vi.fn<
      (opts: {
        command: string;
        stdinContent?: string;
        cwd: string;
        label?: string;
        timeoutMs?: number;
        pollIntervalMs?: number;
        onProgress?: (line: string) => Promise<void>;
      }) => Promise<{ output: string; sessionName: string }>
    >(),
  shellQuote: (s: string) => `'${s.replaceAll("'", "'\\''")}'`,
}));

vi.mock("../tmux/runInTmux", () => tmuxMocks);

import { runClaudeTmux, type RunClaudeTmuxOptions } from "./runClaudeTmux";

describe("runClaudeTmux", () => {
  const defaults: RunClaudeTmuxOptions = {
    systemPrompt: "You are a code reviewer",
    userPrompt: "Review this file",
    cwd: "/tmp/project",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    tmuxMocks.runInTmux.mockResolvedValue({
      output: "claude output here",
      sessionName: "ordine-claude-abc123",
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("delegates to runInTmux with correct claude command", async () => {
    const result = await runClaudeTmux(defaults);

    expect(tmuxMocks.runInTmux).toHaveBeenCalledOnce();
    const call = tmuxMocks.runInTmux.mock.calls[0]![0];
    expect(call.command).toContain("claude");
    expect(call.command).toContain("-p");
    expect(call.command).toContain("--system-prompt");
    expect(call.command).toContain("--dangerously-skip-permissions");
    expect(call.cwd).toBe("/tmp/project");
    expect(call.label).toBe("Claude");
    expect(call.stdinContent).toBe("Review this file");
    expect(result.text).toBe("claude output here");
    expect(result.events).toEqual([]);
    expect(result.sessionName).toBe("ordine-claude-abc123");
  });

  it("includes allowed tools when specified", async () => {
    await runClaudeTmux({
      ...defaults,
      allowedTools: ["Read", "Bash(grep:*)"],
    });

    const call = tmuxMocks.runInTmux.mock.calls[0]![0];
    expect(call.command).toContain("--allowedTools");
    expect(call.command).toContain("Read,Bash(grep:*)");
  });

  it("includes max budget when specified", async () => {
    await runClaudeTmux({ ...defaults, maxBudgetUsd: 10 });

    const call = tmuxMocks.runInTmux.mock.calls[0]![0];
    expect(call.command).toContain("--max-budget-usd");
    expect(call.command).toContain("10");
  });

  it("passes timeout and onProgress through", async () => {
    const onProgress = vi.fn<(line: string) => Promise<void>>().mockResolvedValue(undefined);

    await runClaudeTmux({
      ...defaults,
      timeoutMs: 999,
      onProgress,
    });

    const call = tmuxMocks.runInTmux.mock.calls[0]![0];
    expect(call.timeoutMs).toBe(999);
    expect(call.onProgress).toBe(onProgress);
  });

  it("returns RunClaudeResult with events always empty", async () => {
    tmuxMocks.runInTmux.mockResolvedValue({
      output: "some text output",
      sessionName: "ordine-claude-xyz",
    });

    const result = await runClaudeTmux(defaults);

    expect(result).toEqual({
      text: "some text output",
      events: [],
      sessionName: "ordine-claude-xyz",
    });
  });

  it("truncates long prompts", async () => {
    const longPrompt = "x".repeat(60_000);
    await runClaudeTmux({ ...defaults, userPrompt: longPrompt });

    const call = tmuxMocks.runInTmux.mock.calls[0]![0];
    expect(call.stdinContent!.length).toBeLessThan(longPrompt.length);
    expect(call.stdinContent).toContain("truncated");
  });
});
