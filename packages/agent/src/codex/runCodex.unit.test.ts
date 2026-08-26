import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EventEmitter } from "node:events";
import { Readable, Writable } from "node:stream";
import type { RuntimeEvent } from "@repo/schemas";

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

import {
  runCodex,
  CODEX_SANDBOX_MODES,
  resolveCodexSandbox,
  type RunCodexOptions,
} from "./runCodex";

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
      model: "gpt-5.6-sol",
      reasoningEffort: "high",
      speed: "priority",
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
    expect(args).toContain(resolveCodexSandbox("danger-full-access"));
    expect(args).toContain("--json");
    expect(args).toContain("gpt-5.6-sol");
    expect(args).toContain('model_reasoning_effort="high"');
    expect(args).toContain('service_tier="priority"');
    expect(args).toContain('shell_environment_policy.inherit="all"');
    expect(spawnOpts.cwd).toBe("/tmp/test");
  });

  it("uses an isolated non-interactive runtime config when the job declares no MCP", async () => {
    const promise = runCodex({
      systemPrompt: "sys",
      userPrompt: "user",
      cwd: "/tmp",
    });

    await waitForSpawn();
    const spawnOpts = (
      spawnMock.mock.calls[0] as unknown as [string, string[], { env: Record<string, string> }]
    )[2];
    const codexHome = codexHomeFromEnv(spawnOpts.env);
    const config = await readFile(join(codexHome, "config.toml"), "utf8");
    expect(config).toContain('approval_policy = "never"');
    expect(config).not.toContain("[mcp_servers.");
    expect(config).not.toContain("[windows]");

    testState.mockProc.stdout.push("ok");
    testState.mockProc.stdout.push(null);
    testState.mockProc.stderr.push(null);
    testState.mockProc.emit("close", 0);

    await promise;
    expect(existsSync(codexHome)).toBe(false);
  });

  it("streams completed Codex agent messages before process completion", async () => {
    const onTextDelta = vi.fn();
    const promise = runCodex({
      systemPrompt: "sys",
      userPrompt: "user",
      cwd: "/tmp",
      onTextDelta,
    });

    await waitForSpawn();
    testState.mockProc.stdout.push(
      '{"type":"item.completed","item":{"type":"agent_message","text":"Inspecting input"}}\n',
    );
    testState.mockProc.stdout.push(
      '{"type":"item.completed","item":{"type":"agent_message","text":"Final answer"}}\n',
    );

    await vi.waitFor(() => {
      expect(onTextDelta).toHaveBeenNthCalledWith(1, "Inspecting input");
      expect(onTextDelta).toHaveBeenNthCalledWith(2, "\nFinal answer");
    });

    testState.mockProc.stdout.push(null);
    testState.mockProc.stderr.push(null);
    testState.mockProc.emit("close", 0);

    await expect(promise).resolves.toBe("Inspecting input\nFinal answer");
  });

  it("keeps a scrubbed session home and resumes through the durable ORDINE handle", async () => {
    const events: RuntimeEvent[] = [];
    const firstRun = runCodex({
      systemPrompt: "sys",
      userPrompt: "first",
      cwd: "/tmp",
      connectorInjection: {
        mcpServers: { fs: { command: "fs-mcp", env: { TOKEN: "secret" } } },
        toolNames: ["mcp__fs"],
      },
      onRuntimeEvent: (event) => {
        events.push(event);
      },
    });

    await waitForSpawn();
    const firstSpawn = spawnMock.mock.calls[0] as unknown as [
      string,
      string[],
      { env: Record<string, string> },
    ];
    const sessionHome = codexHomeFromEnv(firstSpawn[2].env);
    testState.mockProc.stdout.push(
      '{"type":"thread.started","thread_id":"thread-123"}\n' +
        '{"type":"item.completed","item":{"type":"agent_message","text":"first done"}}\n',
    );
    testState.mockProc.emit("close", 0);
    await firstRun;

    const sessionEvent = events.find((event) => event.type === "session");
    expect(sessionEvent?.type === "session" ? sessionEvent.id : undefined).toMatch(
      /^ordine-codex:/,
    );
    expect(existsSync(sessionHome)).toBe(true);
    const scrubbedConfig = await readFile(join(sessionHome, "config.toml"), "utf8");
    expect(scrubbedConfig).toContain('approval_policy = "never"');
    expect(scrubbedConfig).not.toContain("[mcp_servers.");

    testState.mockProc = createMockProcess();
    spawnMock.mockClear();
    spawnMock.mockReturnValue(testState.mockProc);
    const resumeHandle = sessionEvent?.type === "session" ? sessionEvent.id : "";
    const resumed = runCodex({
      systemPrompt: "sys",
      userPrompt: "continue",
      cwd: "/tmp",
      resumeSessionId: resumeHandle,
    });
    await waitForSpawn();
    const resumedSpawn = spawnMock.mock.calls[0] as unknown as [
      string,
      string[],
      { env: Record<string, string> },
    ];
    expect(codexHomeFromEnv(resumedSpawn[2].env)).toBe(sessionHome);
    expect(resumedSpawn[1]).toContain("thread-123");
    expect(resumedSpawn[1]).not.toContain(resumeHandle);
    testState.mockProc.stdout.push(
      '{"type":"item.completed","item":{"type":"agent_message","text":"resumed"}}\n',
    );
    testState.mockProc.emit("close", 0);
    await resumed;
    await rm(sessionHome, { recursive: true, force: true });
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
    expect(args).toContain(resolveCodexSandbox("workspace-write"));
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
        toolNames: ["mcp__linear__ordine.describe_resource", "mcp__fs__read_file"],
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
    expect(args).toContain("-c");
    expect(args).toContain("shell_environment_policy.ignore_default_excludes=true");
    expect(args.join(" ")).not.toContain("secret");
    expect(config).toContain("[mcp_servers.linear]");
    expect(config).toContain('url = "https://mcp.linear.app/mcp"');
    expect(config).toContain('enabled_tools = ["ordine.describe_resource"]');
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
    // The path env var is `Path` on Windows but `PATH` on POSIX; expecting
    // `process.env.Path` literally makes this assertion fail off Windows.
    expect(Object.entries(spawnOpts.env).find(([name]) => name.toLowerCase() === "path")?.[1]).toBe(
      process.env.Path ?? process.env.PATH,
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

  it("keeps the Agent Control tool boundary while forwarding its full-access environment", async () => {
    const promise = runCodex({
      systemPrompt: "sys",
      userPrompt: "user",
      cwd: "/tmp/control",
      sandbox: "danger-full-access",
      fullAccessConfirmed: true,
      networkAccess: true,
      agentControlMode: true,
      environment: {
        HOME: "/tmp/control/home",
        USERPROFILE: "/tmp/control/home",
        ORDINE_AGENT_CONTROL_MODE: "1",
        CODEX_HOME: "/must/not/win",
      },
    });

    await waitForSpawn();
    const [, args, spawnOpts] = spawnMock.mock.calls[0] as unknown as [
      string,
      string[],
      { env: Record<string, string | undefined> },
    ];
    const config = await readFile(join(codexHomeFromEnv(spawnOpts.env), "config.toml"), "utf8");
    testState.mockProc.stdout.push("ok");
    testState.mockProc.stdout.push(null);
    testState.mockProc.stderr.push(null);
    testState.mockProc.emit("close", 0);
    await promise;

    expect(args).toContain("--strict-config");
    expect(args).toContain("--ignore-rules");
    const disabledFeatures = args.flatMap((arg, index) =>
      arg === "--disable" ? [args[index + 1]] : [],
    );
    expect(disabledFeatures).toContain("shell_tool");
    expect(disabledFeatures).toContain("browser_use");
    expect(disabledFeatures).toContain("apps");
    expect(disabledFeatures).toContain("plugins");
    expect(disabledFeatures).toContain("multi_agent");
    expect(spawnOpts.env.HOME).toBe("/tmp/control/home");
    expect(spawnOpts.env.USERPROFILE).toBe("/tmp/control/home");
    expect(spawnOpts.env.ORDINE_AGENT_CONTROL_MODE).toBe("1");
    expect(spawnOpts.env.CODEX_HOME).not.toBe("/must/not/win");
    expect(config).toContain('web_search = "disabled"');
  });
});

describe("CODEX_SANDBOX_MODES", () => {
  it("has readOnly, workspaceWrite, fullAccess modes", () => {
    expect(CODEX_SANDBOX_MODES.readOnly).toBe("read-only");
    expect(CODEX_SANDBOX_MODES.workspaceWrite).toBe("workspace-write");
    expect(CODEX_SANDBOX_MODES.fullAccess).toBe("danger-full-access");
  });

  it("never silently upgrades the requested sandbox on Windows or WSL", () => {
    expect(resolveCodexSandbox("workspace-write")).toBe("workspace-write");
    expect(resolveCodexSandbox("read-only")).toBe("read-only");
  });

  it("allows the product default danger-full-access and rejects an explicit denial", async () => {
    spawnMock.mockClear();
    await expect(
      runCodex({
        systemPrompt: "sys",
        userPrompt: "user",
        cwd: "/tmp",
        sandbox: "danger-full-access",
        fullAccessConfirmed: false,
      }),
    ).rejects.toThrow(/explicit user confirmation/);
    expect(spawnMock).not.toHaveBeenCalled();
  });
});
