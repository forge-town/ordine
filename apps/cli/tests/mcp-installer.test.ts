import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyJsonInstall,
  doctorMcpTarget,
  installMcpTarget,
  removeJsonInstall,
  statusMcpTarget,
  uninstallMcpTarget,
} from "../src/mcp/installer";
import {
  MCP_TARGET_IDS,
  FORMAL_MCP_TARGET_IDS,
  parseFormalMcpTargetId,
  planMcpInstall,
  type InstallContext,
  type McpLaunchSpec,
} from "../src/mcp/installRegistry";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

const makeContext = (home: string): InstallContext => ({
  home,
  cwd: join(home, "project"),
  platform: "win32",
  appData: join(home, "AppData", "Roaming"),
  serverName: "ordine",
});

const spec: McpLaunchSpec = {
  command: "ordine",
  args: ["mcp", "serve", "--policy", "safe"],
  env: {},
};
const ownedCodexOutput = "ordine\ncommand: ordine\nargs: mcp serve --policy safe";

describe("MCP install registry", () => {
  it("limits product commands to three targets and accepts the Claude Code alias", () => {
    expect(FORMAL_MCP_TARGET_IDS).toEqual(["codex", "claude", "opencode"]);
    expect(parseFormalMcpTargetId("claude-code")).toBe("claude");
    expect(() => parseFormalMcpTargetId("pi")).toThrow(/Unsupported formal MCP target/);
  });

  it("declares exactly the 19 requested compatibility targets", () => {
    expect(MCP_TARGET_IDS).toHaveLength(19);
    expect(new Set(MCP_TARGET_IDS).size).toBe(19);
    expect(MCP_TARGET_IDS).toEqual(
      expect.arrayContaining([
        "claude",
        "claude-desktop",
        "codex",
        "reasonix",
        "deepseek-harness",
        "raven",
        "cursor",
        "copilot-vscode",
        "copilot",
        "opencode",
        "openclaw",
        "antigravity",
        "cline",
        "trae",
        "kimi",
        "kiro",
        "pi",
        "vibe",
        "hermes",
      ]),
    );
  });

  it("produces an explicit plan for every target", () => {
    const plans = MCP_TARGET_IDS.map((target) =>
      planMcpInstall(target, spec, makeContext("C:\\Users\\test")),
    );

    expect(plans).toHaveLength(19);
    expect(plans.filter((plan) => plan.kind === "cli")).toHaveLength(4);
    expect(plans.filter((plan) => plan.kind === "json")).toHaveLength(11);
    expect(plans.filter((plan) => plan.kind === "manual")).toHaveLength(4);
  });

  it("uses the current Kimi list command for registration checks", () => {
    const plan = planMcpInstall("kimi", spec, makeContext("C:\\Users\\test"));
    if (plan.kind !== "cli") throw new Error("Expected Kimi CLI plan");

    expect(plan.getArgs).toEqual(["mcp", "list"]);
    expect(plan.verifyOutputIncludes).toBe("ordine");
  });
});

describe("deletion-safe JSON registration", () => {
  it("preserves sibling config and refuses to remove a changed entry", () => {
    const plan = planMcpInstall("cursor", spec, makeContext("C:\\Users\\test"));
    if (plan.kind !== "json") throw new Error("Expected Cursor JSON plan");
    const installed = applyJsonInstall(
      JSON.stringify({ theme: "dark", mcpServers: { existing: { command: "other" } } }),
      plan,
    );

    expect(JSON.parse(installed)).toMatchObject({
      theme: "dark",
      mcpServers: {
        existing: { command: "other" },
        ordine: { command: "ordine" },
      },
    });
    const changed = installed.replace('"command": "ordine"', '"command": "someone-else"');
    expect(() => removeJsonInstall(changed, plan)).toThrow("Refusing to remove changed entry");
  });

  it("backs up an existing file, installs, and removes only ORDINE", async () => {
    const home = await mkdtemp(join(tmpdir(), "ordine-mcp-test-"));
    temporaryDirectories.push(home);
    const context = makeContext(home);
    const plan = planMcpInstall("cursor", spec, context);
    if (plan.kind !== "json") throw new Error("Expected Cursor JSON plan");
    await mkdir(join(home, ".cursor"), { recursive: true });
    await writeFile(
      plan.configPath,
      `${JSON.stringify({ mcpServers: { existing: { command: "other" } } }, null, 2)}\n`,
      "utf8",
    );

    const installed = await installMcpTarget({ target: "cursor", spec, context });
    expect(installed.status).toBe("installed");
    expect(installed.backupPath).toBeTruthy();
    expect(JSON.parse(await readFile(plan.configPath, "utf8"))).toMatchObject({
      mcpServers: { existing: { command: "other" }, ordine: { command: "ordine" } },
    });

    const removed = await uninstallMcpTarget({ target: "cursor", spec, context });
    expect(removed.status).toBe("removed");
    expect(JSON.parse(await readFile(plan.configPath, "utf8"))).toEqual({
      mcpServers: { existing: { command: "other" } },
    });
  });

  it("does not touch the filesystem during dry-run", async () => {
    const home = await mkdtemp(join(tmpdir(), "ordine-mcp-dry-run-"));
    temporaryDirectories.push(home);
    const context = makeContext(home);
    const plan = planMcpInstall("kiro", spec, context);
    if (plan.kind !== "json") throw new Error("Expected Kiro JSON plan");

    const result = await installMcpTarget({ target: "kiro", spec, context, dryRun: true });
    const file = await stat(plan.configPath).then(
      () => true,
      () => false,
    );

    expect(result.status).toBe("planned");
    expect(file).toBe(false);
  });

  it("uses agent-owned CLI registration idempotently", async () => {
    const commandRunner = vi.fn(async () => ({
      exitCode: 0,
      stdout: ownedCodexOutput,
      stderr: "",
    }));
    const result = await installMcpTarget({
      target: "codex",
      spec,
      context: makeContext("C:\\Users\\test"),
      commandRunner,
    });

    expect(result.status).toBe("already-installed");
    expect(commandRunner).toHaveBeenCalledOnce();
    expect(commandRunner).toHaveBeenCalledWith("codex", ["mcp", "get", "ordine"]);
  });

  it("refuses to overwrite or remove a same-name CLI registration with drift", async () => {
    const commandRunner = vi.fn(async () => ({
      exitCode: 0,
      stdout: "ordine\ncommand: someone-else\nargs: serve",
      stderr: "",
    }));
    const context = makeContext("C:\\Users\\test");

    await expect(
      installMcpTarget({ target: "codex", spec, context, commandRunner }),
    ).rejects.toThrow("Refusing to overwrite changed entry");
    await expect(
      uninstallMcpTarget({ target: "codex", spec, context, commandRunner }),
    ).rejects.toThrow("Refusing to remove changed entry");
    expect(commandRunner).toHaveBeenCalledTimes(2);
  });

  it("reports CLI and JSON registration drift without probing the protocol", async () => {
    const protocolProbe = vi.fn();
    const commandRunner = vi.fn(async () => ({
      exitCode: 0,
      stdout: "ordine\ncommand: someone-else",
      stderr: "",
    }));
    const context = makeContext("C:\\Users\\test");
    const cliStatus = await statusMcpTarget({
      target: "codex",
      spec,
      context,
      commandRunner,
    });
    const cliDoctor = await doctorMcpTarget({
      target: "codex",
      spec,
      context,
      commandRunner,
      protocolProbe,
    });

    expect(cliStatus.status).toBe("drifted");
    expect(cliDoctor.status).toBe("drifted");
    expect(cliDoctor.evidence?.registered).toBe(false);
    expect(protocolProbe).not.toHaveBeenCalled();
  });

  it("reports session readiness drift when protocol succeeds but preflight fails", async () => {
    const commandRunner = vi.fn(async () => ({
      exitCode: 0,
      stdout: ownedCodexOutput,
      stderr: "",
    }));
    const protocolProbe = vi.fn(async () => ({
      commandLaunchable: true,
      initialize: true,
      toolsList: true,
      safeToolCall: true,
      toolCount: 21,
      apiReachable: false,
      dbReachable: false,
      runtimeCatalogInitialized: false,
      writePolicy: "disabled" as const,
      failureLayer: "api_unreachable" as const,
      message: "Ordine API /health failed: network fetch failed",
    }));

    const result = await doctorMcpTarget({
      target: "codex",
      spec,
      context: makeContext("C:\\Users\\test"),
      commandRunner,
      protocolProbe,
    });

    expect(result.status).toBe("drifted");
    expect(result.message).toContain("api_unreachable");
    expect(result.evidence).toMatchObject({
      registered: true,
      commandLaunchable: true,
      initialize: true,
      toolsList: true,
      safeToolCall: true,
      apiReachable: false,
      dbReachable: false,
      runtimeCatalogInitialized: false,
      writePolicy: "disabled",
      failureLayer: "api_unreachable",
    });
  });

  it("verifies agent-owned CLI registration after installing", async () => {
    const commandRunner = vi
      .fn()
      .mockResolvedValueOnce({ exitCode: 1, stdout: "", stderr: "missing" })
      .mockResolvedValueOnce({ exitCode: 0, stdout: "added", stderr: "" })
      .mockResolvedValueOnce({ exitCode: 0, stdout: "ordine", stderr: "" });
    const result = await installMcpTarget({
      target: "kimi",
      spec,
      context: makeContext("C:\\Users\\test"),
      commandRunner,
    });

    expect(result.status).toBe("installed");
    expect(commandRunner).toHaveBeenNthCalledWith(1, "kimi", ["mcp", "list"]);
    expect(commandRunner).toHaveBeenNthCalledWith(3, "kimi", ["mcp", "list"]);
  });

  it("plans CLI removal during dry-run without probing or mutating the agent", async () => {
    const commandRunner = vi.fn();
    const result = await uninstallMcpTarget({
      target: "kimi",
      spec,
      context: makeContext("C:\\Users\\test"),
      dryRun: true,
      commandRunner,
    });

    expect(result.status).toBe("planned");
    expect(commandRunner).not.toHaveBeenCalled();
  });
});
