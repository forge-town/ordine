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

import { scanRuntimes, type DetectedRuntime } from "./scanRuntimes";

describe("scanRuntimes", () => {
  beforeEach(() => {
    execFileMock.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("detects a runtime when which succeeds and version succeeds", async () => {
    execFileMock.mockImplementation((bin, args, _opts, cb) => {
      if (bin === "which") {
        cb(null, "/usr/local/bin/claude\n", "");
      } else if (args[0] === "--version") {
        cb(null, "claude 1.2.3\n", "");
      } else {
        cb({ message: "unexpected call", code: 1 }, "", "");
      }
    });

    const results = await scanRuntimes();
    const claude = results.find((r) => r.type === "claude-code");

    expect(claude).toBeDefined();
    expect(claude!.path).toBe("/usr/local/bin/claude");
    expect(claude!.version).toBe("claude 1.2.3");
  });

  it("detects a runtime when which succeeds but version fails", async () => {
    execFileMock.mockImplementation((bin, _args, _opts, cb) => {
      if (bin === "which") {
        cb(null, "/usr/local/bin/codex\n", "");
      } else {
        cb({ message: "version failed", code: 1 }, "", "");
      }
    });

    const results = await scanRuntimes();
    const codex = results.find((r) => r.type === "codex");

    expect(codex).toBeDefined();
    expect(codex!.path).toBe("/usr/local/bin/codex");
    expect(codex!.version).toBeUndefined();
  });

  it("does not include a runtime when which fails", async () => {
    execFileMock.mockImplementation((_bin, _args, _opts, cb) => {
      cb({ message: "not found", code: 1 }, "", "");
    });

    const results = await scanRuntimes();

    expect(results).toHaveLength(0);
  });

  it("returns all detected runtimes", async () => {
    execFileMock.mockImplementation((bin, args, _opts, cb) => {
      if (bin === "which") {
        cb(null, `/usr/local/bin/${args[0]}\n`, "");
      } else {
        cb(null, "v1.0.0\n", "");
      }
    });

    const results = await scanRuntimes();

    expect(results.length).toBeGreaterThanOrEqual(4);
    const types = results.map((r) => r.type);

    expect(types).toContain("claude-code");
    expect(types).toContain("codex");
    expect(types).toContain("mastra");
    expect(types).toContain("openclaw");
  });

  it("each detected runtime has correct shape", async () => {
    execFileMock.mockImplementation((bin, args, _opts, cb) => {
      if (bin === "which") {
        cb(null, `/usr/bin/${args[0]}\n`, "");
      } else {
        cb(null, "2.0.0\n", "");
      }
    });

    const results = await scanRuntimes();

    for (const runtime of results) {
      expect(runtime).toHaveProperty("type");
      expect(runtime).toHaveProperty("binaryName");
      expect(runtime).toHaveProperty("path");
    }
  });
});
