import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@repo/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

const tmuxMocks = vi.hoisted(() => ({
  createTmuxSession:
    vi.fn<(opts: { sessionName: string; command: string; cwd: string }) => Promise<void>>(),
  capturePane: vi.fn<(sessionName: string) => Promise<string>>(),
  killTmuxSession: vi.fn<(sessionName: string) => Promise<void>>(),
  isTmuxSessionAlive: vi.fn<(sessionName: string) => Promise<boolean>>(),
  sendKeys: vi.fn<(sessionName: string, text: string) => Promise<void>>(),
  buildSessionName: vi.fn<() => string>(),
}));

vi.mock("./tmuxSession", () => tmuxMocks);

import { runInTmux, type RunInTmuxOptions } from "./runInTmux";

describe("runInTmux", () => {
  const defaults: RunInTmuxOptions = {
    command: "echo hello",
    cwd: "/tmp/project",
    label: "test",
    pollIntervalMs: 10,
    timeoutMs: 500,
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    tmuxMocks.buildSessionName.mockReturnValue("ordine-codex-test123");
    tmuxMocks.createTmuxSession.mockResolvedValue(undefined);
    tmuxMocks.sendKeys.mockResolvedValue(undefined);
    tmuxMocks.killTmuxSession.mockResolvedValue(undefined);
    tmuxMocks.capturePane.mockResolvedValue("");
    tmuxMocks.isTmuxSessionAlive.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("creates a tmux session with the provided command and cwd", async () => {
    tmuxMocks.isTmuxSessionAlive.mockResolvedValueOnce(false);
    tmuxMocks.capturePane.mockResolvedValue("output here");

    const promise = runInTmux(defaults);
    await vi.advanceTimersByTimeAsync(20);
    const result = await promise;

    expect(tmuxMocks.createTmuxSession).toHaveBeenCalledOnce();
    const call = tmuxMocks.createTmuxSession.mock.calls[0]![0];
    expect(call.sessionName).toBe("ordine-codex-test123");
    expect(call.cwd).toBe("/tmp/project");
    expect(call.command).toBe("echo hello");
    expect(result.output).toBe("output here");
    expect(result.sessionName).toBe("ordine-codex-test123");
  });

  it("pipes stdinContent through echo when provided", async () => {
    tmuxMocks.isTmuxSessionAlive.mockResolvedValueOnce(false);
    tmuxMocks.capturePane.mockResolvedValue("ok");

    const promise = runInTmux({
      ...defaults,
      command: "codex exec --sandbox read-only",
      stdinContent: "my prompt text",
    });
    await vi.advanceTimersByTimeAsync(20);
    await promise;

    const call = tmuxMocks.createTmuxSession.mock.calls[0]![0];
    expect(call.command).toContain("codex exec --sandbox read-only");
    expect(call.command).toContain("my prompt text");
  });

  it("calls onProgress when pane content changes", async () => {
    vi.useRealTimers();
    vi.clearAllMocks();
    tmuxMocks.buildSessionName.mockReturnValue("ordine-codex-test123");
    tmuxMocks.createTmuxSession.mockResolvedValue(undefined);
    tmuxMocks.killTmuxSession.mockResolvedValue(undefined);

    const onProgress = vi.fn<(line: string) => Promise<void>>().mockResolvedValue(undefined);
    let pollCount = 0;
    tmuxMocks.isTmuxSessionAlive.mockImplementation(async () => {
      pollCount++;
      return pollCount < 3;
    });
    tmuxMocks.capturePane
      .mockResolvedValueOnce("step 1")
      .mockResolvedValueOnce("step 1\nstep 2")
      .mockResolvedValueOnce("step 1\nstep 2\ndone");

    const result = await runInTmux({ ...defaults, onProgress, pollIntervalMs: 5 });

    expect(onProgress).toHaveBeenCalled();
    expect(result.output).toBe("step 1\nstep 2\ndone");
  });

  it("rejects on timeout and cleans up the session", async () => {
    vi.useRealTimers();
    vi.clearAllMocks();
    tmuxMocks.buildSessionName.mockReturnValue("ordine-codex-test123");
    tmuxMocks.createTmuxSession.mockResolvedValue(undefined);
    tmuxMocks.killTmuxSession.mockResolvedValue(undefined);
    tmuxMocks.isTmuxSessionAlive.mockResolvedValue(true);
    tmuxMocks.capturePane.mockResolvedValue("running...");

    await expect(runInTmux({ ...defaults, timeoutMs: 50, pollIntervalMs: 10 })).rejects.toThrow(
      /timed out/,
    );
    expect(tmuxMocks.killTmuxSession).toHaveBeenCalledWith("ordine-codex-test123");
  });

  it("always cleans up on success", async () => {
    tmuxMocks.isTmuxSessionAlive.mockResolvedValueOnce(false);
    tmuxMocks.capturePane.mockResolvedValue("done");

    const promise = runInTmux(defaults);
    await vi.advanceTimersByTimeAsync(20);
    await promise;

    expect(tmuxMocks.killTmuxSession).toHaveBeenCalledWith("ordine-codex-test123");
  });

  it("rejects and cleans up when session creation fails", async () => {
    vi.useRealTimers();
    vi.clearAllMocks();
    tmuxMocks.buildSessionName.mockReturnValue("ordine-codex-test123");
    tmuxMocks.killTmuxSession.mockResolvedValue(undefined);
    tmuxMocks.createTmuxSession.mockRejectedValue(new Error("tmux not found"));

    await expect(runInTmux(defaults)).rejects.toThrow("tmux not found");
    expect(tmuxMocks.killTmuxSession).toHaveBeenCalled();
  });

  it("strips ANSI escape sequences from output", async () => {
    tmuxMocks.isTmuxSessionAlive.mockResolvedValueOnce(false);
    tmuxMocks.capturePane.mockResolvedValue("\x1b[32mgreen\x1b[0m text");

    const promise = runInTmux(defaults);
    await vi.advanceTimersByTimeAsync(20);
    const result = await promise;

    expect(result.output).toBe("green text");
  });

  it("uses the label in progress messages", async () => {
    tmuxMocks.isTmuxSessionAlive.mockResolvedValueOnce(false);
    tmuxMocks.capturePane.mockResolvedValue("ok");

    const onProgress = vi.fn<(line: string) => Promise<void>>().mockResolvedValue(undefined);

    const promise = runInTmux({ ...defaults, label: "codex", onProgress });
    await vi.advanceTimersByTimeAsync(20);
    await promise;

    const progressCalls = onProgress.mock.calls.map((c) => c[0]);
    expect(progressCalls.some((msg) => msg.includes("codex"))).toBe(true);
  });

  it("uses printf for stdin piping (not echo)", async () => {
    tmuxMocks.isTmuxSessionAlive.mockResolvedValueOnce(false);
    tmuxMocks.capturePane.mockResolvedValue("ok");

    const promise = runInTmux({
      ...defaults,
      command: "mybin",
      stdinContent: "content with \\backslashes",
    });
    await vi.advanceTimersByTimeAsync(20);
    await promise;

    const call = tmuxMocks.createTmuxSession.mock.calls[0]![0];
    expect(call.command).toContain("printf '%s'");
    expect(call.command).not.toMatch(/^echo /);
  });

  it("rejects when isTmuxSessionAlive throws during poll", async () => {
    vi.useRealTimers();
    vi.clearAllMocks();
    tmuxMocks.buildSessionName.mockReturnValue("ordine-codex-test123");
    tmuxMocks.createTmuxSession.mockResolvedValue(undefined);
    tmuxMocks.killTmuxSession.mockResolvedValue(undefined);
    tmuxMocks.isTmuxSessionAlive.mockRejectedValue(new Error("poll boom"));

    await expect(runInTmux({ ...defaults, pollIntervalMs: 5 })).rejects.toThrow("poll boom");
    expect(tmuxMocks.killTmuxSession).toHaveBeenCalled();
  });

  it("rejects when onProgress throws during poll", async () => {
    vi.useRealTimers();
    vi.clearAllMocks();
    tmuxMocks.buildSessionName.mockReturnValue("ordine-codex-test123");
    tmuxMocks.createTmuxSession.mockResolvedValue(undefined);
    tmuxMocks.killTmuxSession.mockResolvedValue(undefined);
    tmuxMocks.isTmuxSessionAlive.mockResolvedValue(true);
    tmuxMocks.capturePane.mockResolvedValue("new content");

    const failingProgress = vi
      .fn<(line: string) => Promise<void>>()
      .mockResolvedValueOnce(undefined) // startup message succeeds
      .mockRejectedValue(new Error("progress callback failed")); // poll call fails

    await expect(
      runInTmux({ ...defaults, onProgress: failingProgress, pollIntervalMs: 5 }),
    ).rejects.toThrow("progress callback failed");
    expect(tmuxMocks.killTmuxSession).toHaveBeenCalled();
  });
});

import { shellQuote } from "./runInTmux";

describe("shellQuote", () => {
  it("wraps simple strings in single quotes", () => {
    expect(shellQuote("hello")).toBe("'hello'");
  });

  it("escapes embedded single quotes", () => {
    expect(shellQuote("it's")).toBe("'it'\\''s'");
  });

  it("handles empty string", () => {
    expect(shellQuote("")).toBe("''");
  });

  it("passes through shell metacharacters safely", () => {
    const input = "Bash(grep:*) && rm -rf /";
    expect(shellQuote(input)).toBe("'Bash(grep:*) && rm -rf /'");
  });

  it("handles paths with spaces", () => {
    expect(shellQuote("/my path/with spaces")).toBe("'/my path/with spaces'");
  });
});
