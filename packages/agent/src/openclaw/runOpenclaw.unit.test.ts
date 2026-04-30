import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@repo/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

type ExecFileCallback = (
  error: { code?: string | number; message: string } | null,
  stdout: string,
  stderr: string,
) => void;

const execFileMock =
  vi.fn<
    (bin: string, args: string[], opts: Record<string, unknown>, cb: ExecFileCallback) => void
  >();

vi.mock("node:child_process", () => ({
  execFile: (bin: string, args: string[], opts: Record<string, unknown>, cb: ExecFileCallback) =>
    execFileMock(bin, args, opts, cb),
}));

const makeJsonResponse = (text: string, runId = "test-run-id") =>
  JSON.stringify({
    runId,
    status: "ok",
    summary: "completed",
    result: {
      payloads: [{ text }],
      meta: { durationMs: 1000, stopReason: "stop", aborted: false },
    },
  });

import { runOpenclaw, type RunOpenclawOptions } from "./runOpenclaw";

describe("runOpenclaw", () => {
  beforeEach(() => {
    execFileMock.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls execFile with correct arguments", async () => {
    execFileMock.mockImplementation((_bin, _args, _opts, cb) => {
      cb(null, makeJsonResponse("Hello"), "");
    });

    const opts: RunOpenclawOptions = {
      systemPrompt: "You are a code reviewer",
      userPrompt: "Review this code",
      cwd: "/tmp/test",
      sessionId: "test-session",
    };

    await runOpenclaw(opts);

    expect(execFileMock).toHaveBeenCalledOnce();
    const [bin, args, execOpts] = execFileMock.mock.calls[0]!;
    expect(bin).toBe("openclaw");
    expect(args).toContain("agent");
    expect(args).toContain("--json");
    expect(args).toContain("--session-id");
    expect(args).toContain("test-session");
    expect(args).toContain("--message");
    expect(execOpts.cwd).toBe("/tmp/test");
  });

  it("passes clean env without test-related vars", async () => {
    execFileMock.mockImplementation((_bin, _args, _opts, cb) => {
      cb(null, makeJsonResponse("ok"), "");
    });

    await runOpenclaw({
      systemPrompt: "sys",
      userPrompt: "user",
      cwd: "/tmp",
      sessionId: "s1",
    });

    const execOpts = execFileMock.mock.calls[0]![2];
    const env = execOpts.env as Record<string, string | undefined>;
    expect(env.NODE_ENV).toBeUndefined();
    expect(env.TEST).toBeUndefined();
    expect(env.VITEST).toBeUndefined();
    expect(env.PATH).toBeDefined();
  });

  it("parses text from stdout JSON payloads", async () => {
    execFileMock.mockImplementation((_bin, _args, _opts, cb) => {
      cb(null, makeJsonResponse("Hello world"), "");
    });

    const result = await runOpenclaw({
      systemPrompt: "sys",
      userPrompt: "user",
      cwd: "/tmp",
      sessionId: "s1",
    });

    expect(result.text).toBe("Hello world");
    expect(result.runId).toBe("test-run-id");
    expect(result.meta.stopReason).toBe("stop");
  });

  it("prepends system prompt to message", async () => {
    execFileMock.mockImplementation((_bin, _args, _opts, cb) => {
      cb(null, makeJsonResponse("ok"), "");
    });

    await runOpenclaw({
      systemPrompt: "You are helpful",
      userPrompt: "Do something",
      cwd: "/tmp",
      sessionId: "s1",
    });

    const args = execFileMock.mock.calls[0]![1];
    const msgIdx = args.indexOf("--message");
    expect(msgIdx).toBeGreaterThan(-1);
    const message = args[msgIdx + 1];
    expect(message).toContain("You are helpful");
    expect(message).toContain("Do something");
  });

  it("reports progress via onProgress callback", async () => {
    execFileMock.mockImplementation((_bin, _args, _opts, cb) => {
      cb(null, makeJsonResponse("chunk"), "");
    });

    const progress: string[] = [];
    await runOpenclaw({
      systemPrompt: "sys",
      userPrompt: "user",
      cwd: "/tmp",
      sessionId: "s1",
      onProgress: async (line) => {
        progress.push(line);
      },
    });

    expect(progress.length).toBeGreaterThan(0);
  });

  it("rejects on non-zero exit code", async () => {
    execFileMock.mockImplementation((_bin, _args, _opts, cb) => {
      cb({ code: 1, message: "exit code 1" }, "", "something went wrong");
    });

    await expect(
      runOpenclaw({
        systemPrompt: "sys",
        userPrompt: "user",
        cwd: "/tmp",
        sessionId: "s1",
      }),
    ).rejects.toThrow(/exited with code 1/);
  });

  it("uses --agent flag when agentName is specified", async () => {
    execFileMock.mockImplementation((_bin, _args, _opts, cb) => {
      cb(null, makeJsonResponse("ok"), "");
    });

    await runOpenclaw({
      systemPrompt: "sys",
      userPrompt: "user",
      cwd: "/tmp",
      agentName: "my-agent",
    });

    const args = execFileMock.mock.calls[0]![1];
    expect(args).toContain("--agent");
    expect(args).toContain("my-agent");
    expect(args).not.toContain("--session-id");
  });

  it("generates session-id when neither agentName nor sessionId provided", async () => {
    execFileMock.mockImplementation((_bin, _args, _opts, cb) => {
      cb(null, makeJsonResponse("ok"), "");
    });

    await runOpenclaw({
      systemPrompt: "sys",
      userPrompt: "user",
      cwd: "/tmp",
    });

    const args = execFileMock.mock.calls[0]![1];
    expect(args).toContain("--session-id");
    const sidIdx = args.indexOf("--session-id");
    expect(args[sidIdx + 1]).toMatch(/^ordine-/);
  });

  it("rejects on invalid JSON stdout", async () => {
    execFileMock.mockImplementation((_bin, _args, _opts, cb) => {
      cb(null, "not valid json", "");
    });

    await expect(
      runOpenclaw({
        systemPrompt: "sys",
        userPrompt: "user",
        cwd: "/tmp",
        sessionId: "s1",
      }),
    ).rejects.toThrow(/invalid JSON/);
  });
});
