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
  shellQuote: (s: string) => `'${s.replace(/'/g, "'\\''")}'`,
}));

vi.mock("../tmux/runInTmux", () => tmuxMocks);

import { runCodexTmux, type RunCodexTmuxOptions } from "./runCodexTmux";

describe("runCodexTmux", () => {
  const defaults: RunCodexTmuxOptions = {
    systemPrompt: "You are a linter",
    userPrompt: "Check this code",
    cwd: "/tmp/project",
    pollIntervalMs: 10,
    timeoutMs: 500,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    tmuxMocks.runInTmux.mockResolvedValue({
      output: "codex output here",
      sessionName: "ordine-codex-abc123",
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("delegates to runInTmux with correct codex command", async () => {
    const result = await runCodexTmux(defaults);

    expect(tmuxMocks.runInTmux).toHaveBeenCalledOnce();
    const call = tmuxMocks.runInTmux.mock.calls[0]![0];
    expect(call.command).toContain("codex");
    expect(call.command).toContain("exec");
    expect(call.command).toContain("--sandbox");
    expect(call.command).toContain("read-only");
    expect(call.cwd).toBe("/tmp/project");
    expect(call.label).toBe("Codex");
    expect(call.stdinContent).toContain("You are a linter");
    expect(call.stdinContent).toContain("Check this code");
    expect(result.output).toBe("codex output here");
    expect(result.sessionName).toBe("ordine-codex-abc123");
  });

  it("uses specified sandbox mode", async () => {
    await runCodexTmux({ ...defaults, sandbox: "workspace-write" });

    const call = tmuxMocks.runInTmux.mock.calls[0]![0];
    expect(call.command).toContain("workspace-write");
  });

  it("includes model flag when specified", async () => {
    await runCodexTmux({ ...defaults, model: "o3" });

    const call = tmuxMocks.runInTmux.mock.calls[0]![0];
    expect(call.command).toContain("--model");
    expect(call.command).toContain("o3");
  });

  it("passes timeout, pollInterval, and onProgress through", async () => {
    const onProgress = vi.fn<(line: string) => Promise<void>>().mockResolvedValue(undefined);

    await runCodexTmux({
      ...defaults,
      timeoutMs: 999,
      pollIntervalMs: 42,
      onProgress,
    });

    const call = tmuxMocks.runInTmux.mock.calls[0]![0];
    expect(call.timeoutMs).toBe(999);
    expect(call.pollIntervalMs).toBe(42);
    expect(call.onProgress).toBe(onProgress);
  });

  it("truncates long prompts in stdinContent", async () => {
    const longPrompt = "x".repeat(60_000);
    await runCodexTmux({ ...defaults, userPrompt: longPrompt });

    const call = tmuxMocks.runInTmux.mock.calls[0]![0];
    expect(call.stdinContent!.length).toBeLessThan(longPrompt.length + 500);
    expect(call.stdinContent).toContain("truncated");
  });
});
