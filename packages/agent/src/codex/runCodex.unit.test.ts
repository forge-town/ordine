import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EventEmitter, Readable, Writable } from "node:stream";

vi.mock("@repo/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

const spawnMock = vi.fn<() => ChildProcess>();

vi.mock("node:child_process", () => ({
  spawn: (...args: unknown[]) => spawnMock(...(args as [])),
}));

const createMockProcess = () => {
  // eslint-disable-next-line unicorn/prefer-event-target -- ChildProcess extends EventEmitter, not EventTarget
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

const waitForSpawn = async () => {
  while (spawnMock.mock.calls.length === 0) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
};

const isolatedCodexHomes = async (): Promise<string[]> => {
  const entries = await readdir(tmpdir());

  return entries.filter((name) => name.startsWith("ordine-codex-home-")).sort();
};

const codexHomeFromEnv = (env: Record<string, string | undefined>): string => {
  const codexHome = env.CODEX_HOME;
  expect(codexHome).toBeDefined();

  return codexHome!;
};

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

    await waitForSpawn();
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
    if (process.platform === "win32") {
      // Windows launches the command shim through cmd.exe — codex.cmd is in the
      // args, not the spawned binary.
      expect(bin).toBe("cmd.exe");
      expect(args).toContain("codex.cmd");
    } else {
      expect(bin).toContain("codex");
    }
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

    await waitForSpawn();
    testState.mockProc.stdout.push("result text");
    testState.mockProc.stdout.push(null);
    testState.mockProc.stderr.push(null);
    testState.mockProc.emit("close", 0);

    const result = await promise;
    expect(result).toBe("result text");
  });

  it("settles on process exit when an inherited stdio pipe never closes", async () => {
    const promise = runCodex({
      systemPrompt: "sys",
      userPrompt: "user",
      cwd: "/tmp",
    });

    await waitForSpawn();
    testState.mockProc.stdout.push("result before descendant pipe closes");
    testState.mockProc.emit("exit", 0);

    await expect(promise).resolves.toBe("result before descendant pipe closes");
  });

  it("rejects on non-zero exit code", async () => {
    const promise = runCodex({
      systemPrompt: "sys",
      userPrompt: "user",
      cwd: "/tmp",
      connectorInjection: {
        mcpServers: { fs: { command: "fs-mcp" } },
        toolNames: ["mcp__fs"],
      },
    });

    await waitForSpawn();
    const spawnOpts = (
      spawnMock.mock.calls[0] as unknown as [string, string[], { env: Record<string, string> }]
    )[2];
    const codexHome = codexHomeFromEnv(spawnOpts.env);
    testState.mockProc.stdout.push(null);
    testState.mockProc.stderr.push("error details");
    testState.mockProc.stderr.push(null);
    testState.mockProc.emit("close", 1);

    await expect(promise).rejects.toThrow(/exited with code 1/);
    expect(existsSync(codexHome)).toBe(false);
  });

  it("uses workspace-write sandbox when write tools are requested", async () => {
    const promise = runCodex({
      systemPrompt: "sys",
      userPrompt: "user",
      cwd: "/tmp",
      sandbox: "workspace-write",
    });

    await waitForSpawn();
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

    await waitForSpawn();
    testState.mockProc.stdout.push("ok");
    testState.mockProc.stdout.push(null);
    testState.mockProc.stderr.push(null);
    testState.mockProc.emit("close", 0);

    await promise;

    const args = (spawnMock.mock.calls[0] as unknown as [string, string[]])[1];
    expect(args).toContain("--model");
    expect(args).toContain("o3");
  });

  it("injects MCP servers through an isolated config without leaking secrets", async () => {
    const promise = runCodex({
      systemPrompt: "sys",
      userPrompt: "user",
      cwd: "/tmp",
      connectorInjection: {
        mcpServers: {
          linear: {
            type: "http",
            url: "https://mcp.linear.app/mcp",
            headers: { Authorization: "Bearer secret" },
          },
          fs: {
            command: "npx",
            args: ["-y", "server-fs"],
            env: { TOKEN: "secret" },
          },
        },
        toolNames: ["mcp__linear", "mcp__fs__read_file"],
      },
    });

    await waitForSpawn();
    const [bin, args, spawnOpts] = spawnMock.mock.calls[0] as unknown as [
      string,
      string[],
      Record<string, unknown>,
    ];
    const env = spawnOpts.env as Record<string, string>;
    const codexHome = codexHomeFromEnv(env);
    const configPath = join(codexHome, "config.toml");
    const config = await readFile(configPath, "utf8");

    expect(bin).toBeDefined();
    expect(args).not.toContain("-c");
    expect(args.join(" ")).not.toContain("secret");
    expect(config).toContain("[mcp_servers.linear]");
    expect(config).toContain('url = "https://mcp.linear.app/mcp"');
    expect(config).toContain("[mcp_servers.fs]");
    expect(config).toContain("[mcp_servers.fs.env]");
    expect(config).toContain('TOKEN = "secret"');
    expect(config).toContain('enabled_tools = ["read_file"]');
    expect(env.TOKEN).not.toBe("secret");
    expect(env.ORDINE_MCP_0_0).toBe("Bearer secret");

    testState.mockProc.stdout.push("ok");
    testState.mockProc.stdout.push(null);
    testState.mockProc.stderr.push(null);
    testState.mockProc.emit("close", 0);

    await promise;
    expect(existsSync(codexHome)).toBe(false);
  });

  it("isolates same-named stdio environment values per MCP server", async () => {
    const promise = runCodex({
      systemPrompt: "sys",
      userPrompt: "user",
      cwd: "/tmp",
      connectorInjection: {
        mcpServers: {
          first: { command: "first-mcp", env: { TOKEN: "first" } },
          second: { command: "second-mcp", env: { TOKEN: "second" } },
        },
        toolNames: ["mcp__first", "mcp__second"],
      },
    });

    await waitForSpawn();
    const spawnOpts = (
      spawnMock.mock.calls[0] as unknown as [string, string[], { env: Record<string, string> }]
    )[2];
    const config = await readFile(join(codexHomeFromEnv(spawnOpts.env), "config.toml"), "utf8");
    expect(config).toContain("[mcp_servers.first.env]");
    expect(config).toContain('TOKEN = "first"');
    expect(config).toContain("[mcp_servers.second.env]");
    expect(config).toContain('TOKEN = "second"');
    expect(spawnOpts.env.TOKEN).not.toBe("first");
    expect(spawnOpts.env.TOKEN).not.toBe("second");

    testState.mockProc.stdout.push("ok");
    testState.mockProc.stdout.push(null);
    testState.mockProc.stderr.push(null);
    testState.mockProc.emit("close", 0);
    await promise;
  });

  it("keeps stdio MCP environment names out of the Codex process", async () => {
    const promise = runCodex({
      systemPrompt: "sys",
      userPrompt: "user",
      cwd: "/tmp",
      connectorInjection: {
        mcpServers: {
          unsafe: {
            command: "unsafe-mcp",
            env: { Codex_Home: "/tmp/x", NODE_OPTIONS: "--require attack", Path: "ATTACK" },
          },
        },
        toolNames: ["mcp__unsafe"],
      },
    });

    await waitForSpawn();
    const spawnOpts = (
      spawnMock.mock.calls[0] as unknown as [string, string[], { env: Record<string, string> }]
    )[2];
    const config = await readFile(join(codexHomeFromEnv(spawnOpts.env), "config.toml"), "utf8");
    expect(config).toContain('Codex_Home = "/tmp/x"');
    expect(config).toContain('NODE_OPTIONS = "--require attack"');
    expect(config).toContain('Path = "ATTACK"');
    expect(spawnOpts.env.CODEX_HOME).not.toBe("/tmp/x");
    expect(spawnOpts.env.NODE_OPTIONS).toBe(process.env.NODE_OPTIONS);
    expect(Object.entries(spawnOpts.env).find(([name]) => name.toLowerCase() === "path")?.[1]).toBe(
      process.env.Path,
    );

    testState.mockProc.stdout.push("ok");
    testState.mockProc.stdout.push(null);
    testState.mockProc.stderr.push(null);
    testState.mockProc.emit("close", 0);
    await promise;
  });

  it("allocates collision-free HTTP header secret names", async () => {
    const promise = runCodex({
      systemPrompt: "sys",
      userPrompt: "user",
      cwd: "/tmp",
      connectorInjection: {
        mcpServers: {
          "foo-bar": {
            type: "http",
            url: "https://first.example.com/mcp",
            headers: { Authorization: "Bearer first" },
          },
          foo_bar: {
            type: "http",
            url: "https://second.example.com/mcp",
            headers: { Authorization: "Bearer second" },
          },
        },
        toolNames: ["mcp__foo-bar", "mcp__foo_bar"],
      },
    });

    await waitForSpawn();
    const spawnOpts = (
      spawnMock.mock.calls[0] as unknown as [string, string[], { env: Record<string, string> }]
    )[2];
    const config = await readFile(join(codexHomeFromEnv(spawnOpts.env), "config.toml"), "utf8");
    expect(config).toContain('Authorization = "ORDINE_MCP_0_0"');
    expect(config).toContain('Authorization = "ORDINE_MCP_1_0"');
    expect(spawnOpts.env.ORDINE_MCP_0_0).toBe("Bearer first");
    expect(spawnOpts.env.ORDINE_MCP_1_0).toBe("Bearer second");

    testState.mockProc.stdout.push("ok");
    testState.mockProc.stdout.push(null);
    testState.mockProc.stderr.push(null);
    testState.mockProc.emit("close", 0);
    await promise;
  });

  it("removes the isolated home when progress reporting throws", async () => {
    const homesBefore = await isolatedCodexHomes();

    await expect(
      runCodex({
        systemPrompt: "sys",
        userPrompt: "user",
        cwd: "/tmp",
        connectorInjection: {
          mcpServers: { fs: { command: "fs-mcp" } },
          toolNames: ["mcp__fs"],
        },
        onProgress: vi.fn().mockRejectedValue(new Error("progress failed")),
      }),
    ).rejects.toThrow("progress failed");

    expect(spawnMock).not.toHaveBeenCalled();
    expect(await isolatedCodexHomes()).toEqual(homesBefore);
  });

  it("removes the isolated home when spawning fails", async () => {
    const promise = runCodex({
      systemPrompt: "sys",
      userPrompt: "user",
      cwd: "/tmp",
      connectorInjection: {
        mcpServers: { fs: { command: "fs-mcp" } },
        toolNames: ["mcp__fs"],
      },
    });

    await waitForSpawn();
    const spawnOpts = (
      spawnMock.mock.calls[0] as unknown as [string, string[], { env: Record<string, string> }]
    )[2];
    const codexHome = codexHomeFromEnv(spawnOpts.env);
    testState.mockProc.emit("error", new Error("spawn failed"));

    await expect(promise).rejects.toThrow("spawn failed");
    expect(existsSync(codexHome)).toBe(false);
  });

  it("rejects on timeout", async () => {
    vi.useFakeTimers();

    const promise = runCodex({
      systemPrompt: "sys",
      userPrompt: "user",
      cwd: "/tmp",
      timeoutMs: 1000,
      connectorInjection: {
        mcpServers: { fs: { command: "fs-mcp" } },
        toolNames: ["mcp__fs"],
      },
    });

    // Attach the rejection handler before advancing timers
    const rejectPromise = expect(promise).rejects.toThrow(/timed out/);

    await vi.waitFor(() => expect(spawnMock).toHaveBeenCalledOnce());
    const spawnOpts = (
      spawnMock.mock.calls[0] as unknown as [string, string[], { env: Record<string, string> }]
    )[2];
    const codexHome = codexHomeFromEnv(spawnOpts.env);
    await vi.advanceTimersByTimeAsync(1001);
    await rejectPromise;

    expect(testState.mockProc.kill).toHaveBeenCalledWith("SIGTERM");
    expect(existsSync(codexHome)).toBe(false);

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

    await waitForSpawn();
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
