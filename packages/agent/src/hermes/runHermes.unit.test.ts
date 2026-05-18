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

import { MAX_HERMES_PROMPT_ARG_CHARS, runHermes, type RunHermesOptions } from "./runHermes";

describe("runHermes", () => {
  beforeEach(() => {
    execFileMock.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls hermes -z with combined prompt, cwd, timeout, and model", async () => {
    execFileMock.mockImplementation((_bin, _args, _opts, cb) => {
      cb(null, "Hermes output", "");
    });

    const opts: RunHermesOptions = {
      systemPrompt: "You are precise",
      userPrompt: "Analyze this",
      cwd: "/tmp/test",
      model: "nous-hermes-4",
      allowedTools: ["WebSearch", "WebFetch"],
      timeoutMs: 1234,
    };

    const result = await runHermes(opts);

    expect(result.isOk()).toBe(true);
    expect(execFileMock).toHaveBeenCalledOnce();
    const [bin, args, execOpts] = execFileMock.mock.calls[0]!;
    expect(bin).toBe("hermes");
    expect(args[0]).toBe("-z");
    expect(args[1]).toContain("You are precise");
    expect(args[1]).toContain("Analyze this");
    expect(args).toContain("--toolsets");
    expect(args).toContain("safe");
    expect(args).toContain("--model");
    expect(args).toContain("nous-hermes-4");
    expect(execOpts.cwd).toBe("/tmp/test");
    expect(execOpts.timeout).toBe(1234);
  });

  it("does not enable Hermes toolsets when no tools are allowed", async () => {
    execFileMock.mockImplementation((_bin, _args, _opts, cb) => {
      cb(null, "Hermes output", "");
    });

    const result = await runHermes({
      systemPrompt: "sys",
      userPrompt: "user",
      cwd: "/tmp",
      allowedTools: [],
    });

    expect(result.isOk()).toBe(true);
    const [, args] = execFileMock.mock.calls[0]!;
    expect(args).not.toContain("--toolsets");
    expect(args).not.toContain("safe");
  });

  it("returns an error when prompts exceed the Hermes CLI argument limit", async () => {
    const result = await runHermes({
      systemPrompt: "",
      userPrompt: "x".repeat(MAX_HERMES_PROMPT_ARG_CHARS + 1),
      cwd: "/tmp",
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.message).toMatch(/too large/);
    expect(execFileMock).not.toHaveBeenCalled();
  });

  it("returns an error for local tool allowlists because Hermes cannot enforce them safely", async () => {
    const result = await runHermes({
      systemPrompt: "sys",
      userPrompt: "user",
      cwd: "/tmp",
      allowedTools: ["Read"],
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toMatch(/cannot safely honor local tool permissions/);
    }
    expect(execFileMock).not.toHaveBeenCalled();
  });

  it("returns an error for partial safe tool allowlists because Hermes only exposes the full safe toolset", async () => {
    const result = await runHermes({
      systemPrompt: "sys",
      userPrompt: "user",
      cwd: "/tmp",
      allowedTools: ["WebSearch"],
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.message).toMatch(/partial safe toolset/);
    expect(execFileMock).not.toHaveBeenCalled();
  });

  it("returns stdout text on success", async () => {
    execFileMock.mockImplementation((_bin, _args, _opts, cb) => {
      cb(null, "final stdout", "");
    });

    const result = await runHermes({
      systemPrompt: "sys",
      userPrompt: "user",
      cwd: "/tmp",
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) expect(result.value).toBe("final stdout");
  });

  it("reports progress", async () => {
    execFileMock.mockImplementation((_bin, _args, _opts, cb) => {
      cb(null, "done", "");
    });

    const progress: string[] = [];
    const result = await runHermes({
      systemPrompt: "sys",
      userPrompt: "user",
      cwd: "/tmp",
      onProgress: async (line) => {
        progress.push(line);
      },
    });

    expect(result.isOk()).toBe(true);
    expect(progress).toEqual([
      "[Hermes] Starting hermes -z (cwd=/tmp)...",
      "[Hermes] Complete (4 chars)",
    ]);
  });

  it("rejects on non-zero exit code", async () => {
    execFileMock.mockImplementation((_bin, _args, _opts, cb) => {
      cb({ code: 2, message: "exit code 2" }, "", "bad config");
    });

    const result = await runHermes({
      systemPrompt: "sys",
      userPrompt: "user",
      cwd: "/tmp",
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.message).toMatch(/hermes exited with code 2/);
  });

  it("falls back to error message when stderr is empty", async () => {
    execFileMock.mockImplementation((_bin, _args, _opts, cb) => {
      cb({ code: 2, message: "spawn failed" }, "", "");
    });

    const result = await runHermes({
      systemPrompt: "sys",
      userPrompt: "user",
      cwd: "/tmp",
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toBe("hermes exited with code 2: spawn failed");
    }
  });

  it("returns an error for empty stdout", async () => {
    execFileMock.mockImplementation((_bin, _args, _opts, cb) => {
      cb(null, "   ", "");
    });

    const result = await runHermes({
      systemPrompt: "sys",
      userPrompt: "user",
      cwd: "/tmp",
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.message).toMatch(/empty output/);
  });
});
