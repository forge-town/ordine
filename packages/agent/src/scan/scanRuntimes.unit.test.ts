import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const accessMock = vi.fn<(path: string, mode?: number) => Promise<void>>();
const probeRuntimeModelsMock = vi.fn();

vi.mock("node:fs/promises", () => ({
  access: (path: string, mode?: number) => accessMock(path, mode),
}));

vi.mock("@repo/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock("./probeRuntimeModels", () => ({
  probeRuntimeModels: (...args: unknown[]) => probeRuntimeModelsMock(...args),
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

import {
  firstPath,
  getRuntimeBinaries,
  locateBinaryCommand,
  parseExtraRuntimes,
  scanRuntimes,
  versionCommand,
} from "./scanRuntimes";

const LOCATE_BIN = locateBinaryCommand();

describe("scanRuntimes", () => {
  beforeEach(() => {
    execFileMock.mockClear();
    probeRuntimeModelsMock.mockReset();
    probeRuntimeModelsMock.mockResolvedValue(undefined);
    accessMock.mockReset();
    vi.stubEnv("ORDINE_EXTRA_RUNTIMES", "");
    // Default: filesystem probing finds nothing (keeps tests hermetic —
    // the real machine may actually have these binaries installed).
    accessMock.mockRejectedValue(new Error("ENOENT"));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("detects a runtime when which succeeds and version succeeds", async () => {
    execFileMock.mockImplementation((bin, args, _opts, cb) => {
      if (bin === LOCATE_BIN) {
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
      if (bin === LOCATE_BIN) {
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

  it("attaches the probed model catalog to a detected runtime", async () => {
    execFileMock.mockImplementation((bin, args, _opts, cb) => {
      if (bin === LOCATE_BIN) {
        cb(null, `/usr/local/bin/${args[0]}\n`, "");
      } else {
        cb(null, "v1.0.0\n", "");
      }
    });
    probeRuntimeModelsMock.mockImplementation(async (runtime: { type: string }) =>
      runtime.type === "codex"
        ? [{ id: "gpt-5.6-sol", displayName: "GPT-5.6-Sol", supportsImageInput: true }]
        : undefined,
    );

    const results = await scanRuntimes();

    expect(results.find((runtime) => runtime.type === "codex")?.models).toEqual([
      { id: "gpt-5.6-sol", displayName: "GPT-5.6-Sol", supportsImageInput: true },
    ]);
  });

  it("does not include a runtime when which fails and fallback dirs miss", async () => {
    execFileMock.mockImplementation((_bin, _args, _opts, cb) => {
      cb({ message: "not found", code: 1 }, "", "");
    });

    const results = await scanRuntimes();

    expect(results).toHaveLength(0);
  });

  it("falls back to common install dirs when which fails", async () => {
    execFileMock.mockImplementation((bin, args, _opts, cb) => {
      if (args[0] === "--version") {
        cb(null, "kimi 1.0.0\n", "");

        return;
      }
      cb({ message: "not found", code: 1 }, "", "");
    });
    accessMock.mockImplementation(async (path) => {
      if (/[\\/]\.local[\\/]bin[\\/]kimi$/.test(path)) return;
      throw new Error("ENOENT");
    });

    const results = await scanRuntimes();
    const kimi = results.find((r) => r.type === "kimi-code");

    expect(kimi).toBeDefined();
    expect(kimi!.path).toMatch(/\.local[\\/]bin[\\/]kimi$/);
    expect(kimi!.version).toBe("kimi 1.0.0");
  });

  it("returns all detected runtimes", async () => {
    execFileMock.mockImplementation((bin, args, _opts, cb) => {
      if (bin === LOCATE_BIN) {
        cb(null, `/usr/local/bin/${args[0]}\n`, "");
      } else {
        cb(null, "v1.0.0\n", "");
      }
    });

    const results = await scanRuntimes();

    expect(results.length).toBeGreaterThanOrEqual(10);
    const types = results.map((r) => r.type);

    expect(types).toContain("claude-code");
    expect(types).toContain("codex");
    expect(types).toContain("mastra");
    expect(types).toContain("openclaw");
    expect(types).toContain("hermes");
    expect(types).toContain("pi-agent");
    expect(types).toContain("opencode");
    expect(types).toContain("kimi-code");
    expect(types).toContain("mistral-vibe");
  });

  it("detects hermes when the binary exists", async () => {
    execFileMock.mockImplementation((bin, args, _opts, cb) => {
      if (bin === LOCATE_BIN && args[0] === "hermes") {
        cb(null, "/usr/local/bin/hermes\n", "");

        return;
      }

      if (bin === "/usr/local/bin/hermes") {
        cb(null, "hermes 0.1.0\n", "");

        return;
      }

      cb({ message: "not found", code: 1 }, "", "");
    });

    const results = await scanRuntimes();
    const hermes = results.find((r) => r.type === "hermes");

    expect(hermes).toMatchObject({
      type: "hermes",
      binaryName: "hermes",
      path: "/usr/local/bin/hermes",
      version: "hermes 0.1.0",
      compatibility: { runtime: "hermes", streamFormat: "acp-json-rpc" },
    });
  });

  it("preserves Windows PATH order between executable files and command shims", () => {
    const path = firstPath("C:\\bin\\hermes.cmd\r\nC:\\bin\\hermes.exe\r\n", "win32");

    expect(path).toBe("C:\\bin\\hermes.cmd");
  });

  it("prefers Windows command shims over extensionless shell scripts", () => {
    const path = firstPath("C:\\bin\\claude\r\nC:\\bin\\claude.cmd\r\n", "win32");

    expect(path).toBe("C:\\bin\\claude.cmd");
  });

  it("does not let a later Microsoft Store executable override an npm command shim", () => {
    const path = firstPath(
      [
        "C:\\Users\\owner\\AppData\\Roaming\\npm\\codex",
        "C:\\Users\\owner\\AppData\\Roaming\\npm\\codex.cmd",
        "C:\\Program Files\\WindowsApps\\OpenAI.Codex_1.0.0_x64__id\\codex.exe",
      ].join("\r\n"),
      "win32",
    );

    expect(path).toBe("C:\\Users\\owner\\AppData\\Roaming\\npm\\codex.cmd");
  });

  it("runs Windows command shim version checks through cmd.exe", () => {
    expect(versionCommand("C:\\bin\\claude.cmd", "win32")).toEqual({
      bin: "cmd.exe",
      args: ["/d", "/s", "/c", "C:\\bin\\claude.cmd", "--version"],
    });
    expect(versionCommand("/usr/local/bin/claude", "linux")).toEqual({
      bin: "/usr/local/bin/claude",
      args: ["--version"],
    });
  });

  it("uses the first locate result on non-Windows platforms", () => {
    const path = firstPath("C:\\bin\\hermes.cmd\r\nC:\\bin\\hermes.exe\r\n", "linux");

    expect(path).toBe("C:\\bin\\hermes.cmd");
  });

  it("accepts an existing absolute binary override without passing it to where", async () => {
    const absoluteBinary =
      process.platform === "win32" ? "C:\\tools\\hermes.exe" : "/opt/hermes/bin/hermes";
    execFileMock.mockImplementation((bin, args, _opts, cb) => {
      if (bin === absoluteBinary && args[0] === "--version") {
        cb(null, "hermes 0.16.0\n", "");

        return;
      }
      cb({ message: "not found", code: 1 }, "", "");
    });
    accessMock.mockImplementation(async (path) => {
      if (path === absoluteBinary) return;
      throw new Error("ENOENT");
    });
    vi.stubEnv("ORDINE_EXTRA_RUNTIMES", `hermes:${absoluteBinary}`);

    const results = await scanRuntimes();

    expect(results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "hermes",
          binaryName: absoluteBinary,
          path: absoluteBinary,
          version: "hermes 0.16.0",
          compatibility: expect.objectContaining({ runtime: "hermes" }),
        }),
      ]),
    );
    expect(execFileMock).not.toHaveBeenCalledWith(
      LOCATE_BIN,
      [absoluteBinary],
      expect.anything(),
      expect.anything(),
    );
  });

  it("parses ORDINE_EXTRA_RUNTIMES and merges into the catalog", () => {
    expect(parseExtraRuntimes("foo:foo-bin,bar:bar-cli")).toEqual({
      foo: "foo-bin",
      bar: "bar-cli",
    });
    // Defensive: empty segments, missing colons, and empty name|bin are all ignored.
    expect(parseExtraRuntimes(" , baz , qux: , :only-bin , ok:ok-bin ")).toEqual({
      ok: "ok-bin",
    });
    expect(parseExtraRuntimes(undefined)).toEqual({});
  });

  it("lets ORDINE_EXTRA_RUNTIMES register binaries for enum runtimes only", () => {
    // Names outside AgentRuntimeSchema are ignored — the rest of the stack
    // (DRIVERS, UI) is closed over the enum, so a truly unknown type would
    // only be rejected downstream.
    const withUnknown = getRuntimeBinaries({ ORDINE_EXTRA_RUNTIMES: "myagent:my-bin" });
    expect(withUnknown).not.toHaveProperty("myagent");
    expect(withUnknown).toHaveProperty("claude-code", "claude");

    // A known runtime's binary can be overridden (e.g. a renamed CLI).
    const withOverride = getRuntimeBinaries({ ORDINE_EXTRA_RUNTIMES: "codex:custom-codex" });
    expect(withOverride).toHaveProperty("codex", "custom-codex");

    // Any enum member can be (re)registered, not just builtin ones.
    const withEnumMember = getRuntimeBinaries({ ORDINE_EXTRA_RUNTIMES: "kimi-code:kimi-custom" });
    expect(withEnumMember).toHaveProperty("kimi-code", "kimi-custom");
  });

  it("each detected runtime has correct shape", async () => {
    execFileMock.mockImplementation((bin, args, _opts, cb) => {
      if (bin === LOCATE_BIN) {
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
