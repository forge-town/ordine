import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChildProcess } from "node:child_process";
import { EventEmitter, Readable, Writable } from "node:stream";

vi.mock("@repo/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

const spawnMock = vi.fn<() => ChildProcess>();

vi.mock("node:child_process", () => ({
  spawn: (...args: unknown[]) => spawnMock(...(args as [])),
}));

const createMockProcess = () => {
  const proc = new EventEmitter() as ChildProcess & {
    stdin: Writable;
    stdout: Readable;
    stderr: Readable;
  };
  proc.stdin = new Writable({
    highWaterMark: 1024 * 1024,
    write(_chunk, _enc, cb) {
      cb();
    },
  });
  proc.stdout = new Readable({ read() {} });
  proc.stderr = new Readable({ read() {} });
  proc.kill = vi.fn();

  return proc;
};

import { runCodex, CODEX_SANDBOX_MODES, type RunCodexOptions } from "./runCodex";

const tick = () => new Promise((r) => setTimeout(r, 0));

describe("runCodex", () => {
  const testState = {
    mockProc: createMockProcess(),
  };

  beforeEach(() => {
    testState.mockProc = createMockProcess();
    spawnMock.mockClear();
    spawnMock.mockReturnValue(testState.mockProc);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("spawns codex exec with correct arguments", async () => {
    const opts: RunCodexOptions = {
      systemPrompt: "You are a linter",
      userPrompt: "Check this code",
      cwd: "/tmp/test",
    };

    const promise = runCodex(opts);

    await tick();
    testState.mockProc.stdout.push("Hello from codex");
    testState.mockProc.stdout.push(null);
    testState.mockProc.stderr.push(null);
    testState.mockProc.emit("close", 0);

    await promise;

    expect(spawnMock).toHaveBeenCalledOnce();
    const [bin, args, spawnOpts] = spawnMock.mock.calls[0] as unknown as [
      string,
      string[],
      Record<string, unknown>,
    ];
    expect(bin).toContain("codex");
    expect(args).toContain("exec");
    expect(args).toContain("--sandbox");
    expect(args).toContain("read-only");
    expect(spawnOpts.cwd).toBe("/tmp/test");
  });

  it("returns stdout text on success", async () => {
    const promise = runCodex({
      systemPrompt: "sys",
      userPrompt: "user",
      cwd: "/tmp",
    });

    await tick();
    testState.mockProc.stdout.push("result text");
    testState.mockProc.stdout.push(null);
    testState.mockProc.stderr.push(null);
    testState.mockProc.emit("close", 0);

    const result = await promise;
    expect(result).toBe("result text");
  });

  it("rejects on non-zero exit code", async () => {
    const promise = runCodex({
      systemPrompt: "sys",
      userPrompt: "user",
      cwd: "/tmp",
    });

    await tick();
    testState.mockProc.stdout.push(null);
    testState.mockProc.stderr.push("error details");
    testState.mockProc.stderr.push(null);
    testState.mockProc.emit("close", 1);

    await expect(promise).rejects.toThrow(/exited with code 1/);
  });

  it("uses workspace-write sandbox when write tools are requested", async () => {
    const promise = runCodex({
      systemPrompt: "sys",
      userPrompt: "user",
      cwd: "/tmp",
      sandbox: "workspace-write",
    });

    await tick();
    testState.mockProc.stdout.push("ok");
    testState.mockProc.stdout.push(null);
    testState.mockProc.stderr.push(null);
    testState.mockProc.emit("close", 0);

    await promise;

    const args = (spawnMock.mock.calls[0] as unknown as [string, string[]])[1];
    expect(args).toContain("workspace-write");
  });

  it("passes model flag when specified", async () => {
    const promise = runCodex({
      systemPrompt: "sys",
      userPrompt: "user",
      cwd: "/tmp",
      model: "o3",
    });

    await tick();
    testState.mockProc.stdout.push("ok");
    testState.mockProc.stdout.push(null);
    testState.mockProc.stderr.push(null);
    testState.mockProc.emit("close", 0);

    await promise;

    const args = (spawnMock.mock.calls[0] as unknown as [string, string[]])[1];
    expect(args).toContain("--model");
    expect(args).toContain("o3");
  });

  it("rejects on timeout", async () => {
    vi.useFakeTimers();

    const promise = runCodex({
      systemPrompt: "sys",
      userPrompt: "user",
      cwd: "/tmp",
      timeoutMs: 1000,
    });

    // Attach the rejection handler before advancing timers
    const rejectPromise = expect(promise).rejects.toThrow(/timed out/);

    await vi.advanceTimersByTimeAsync(1001);
    await rejectPromise;

    expect(testState.mockProc.kill).toHaveBeenCalledWith("SIGTERM");

    vi.useRealTimers();
  });

  it("truncates long prompts", async () => {
    const written: string[] = [];
    testState.mockProc.stdin = new Writable({
      highWaterMark: 1024 * 1024,
      write(chunk, _enc, cb) {
        written.push(chunk.toString());
        cb();
      },
    });

    const longPrompt = "x".repeat(60_000);
    const promise = runCodex({
      systemPrompt: "sys",
      userPrompt: longPrompt,
      cwd: "/tmp",
    });

    await tick();
    testState.mockProc.stdout.push("ok");
    testState.mockProc.stdout.push(null);
    testState.mockProc.stderr.push(null);
    testState.mockProc.emit("close", 0);

    await promise;

    const fullWritten = written.join("");
    expect(fullWritten.length).toBeLessThan(longPrompt.length);
    expect(fullWritten).toContain("truncated");
  });
});

describe("CODEX_SANDBOX_MODES", () => {
  it("has readOnly, workspaceWrite, fullAccess modes", () => {
    expect(CODEX_SANDBOX_MODES.readOnly).toBe("read-only");
    expect(CODEX_SANDBOX_MODES.workspaceWrite).toBe("workspace-write");
    expect(CODEX_SANDBOX_MODES.fullAccess).toBe("danger-full-access");
  });
});
