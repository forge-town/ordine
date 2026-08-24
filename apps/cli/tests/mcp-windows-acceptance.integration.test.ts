import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

const enabled =
  process.platform === "win32" && process.env["ORDINE_WINDOWS_MCP_ACCEPTANCE"] === "1";
const targets = ["codex", "claude", "opencode"] as const;

type CliResult = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
};

type McpResult = {
  target: string;
  operation: string;
  status: string;
  evidence?: {
    recognized: boolean;
    planned: boolean;
    registered: boolean;
    commandLaunchable: boolean;
    initialize: boolean;
    toolsList: boolean;
    safeToolCall: boolean;
    toolCount?: number;
  };
};

const report = {
  generatedAt: new Date().toISOString(),
  platform: process.platform,
  serverName: "",
  launch: { command: "", cliFile: "", apiUrl: "", tokenTransport: "dynamic-file" },
  targets: [] as Array<{
    target: string;
    install?: McpResult;
    status?: McpResult;
    doctor?: McpResult;
    uninstall?: McpResult;
    finalStatus?: McpResult;
    error?: string;
  }>,
};

let acceptanceRoot = "";
let reportPath = "";
let nodePath = "";
let cliFile = "";
let apiUrl = "";
let tokenFile = "";
let serverName = "";

const runCli = (args: readonly string[]): Promise<CliResult> =>
  new Promise((resolvePromise) => {
    const child = spawn(nodePath, [cliFile, "--json", ...args], {
      cwd: resolve(import.meta.dirname, ".."),
      env: { ...process.env },
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.on("error", (error) =>
      resolvePromise({ exitCode: null, stdout: "", stderr: error.message }),
    );
    child.on("close", (exitCode) =>
      resolvePromise({
        exitCode,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      }),
    );
  });

const installerArgs = (operation: string, target: string): string[] => [
  "mcp",
  operation,
  target,
  "--server-name",
  serverName,
  "--command",
  nodePath,
  "--cli-file",
  cliFile,
  "--env",
  `ORDINE_API_URL=${apiUrl}`,
  "--env",
  `ORDINE_DESKTOP_AUTH_TOKEN_FILE=${tokenFile}`,
];

const parseResult = (execution: CliResult, operation: string): McpResult => {
  if (execution.exitCode !== 0) {
    throw new Error(
      `${operation} exited ${execution.exitCode}: ${execution.stderr.trim() || execution.stdout.trim()}`,
    );
  }
  const parsed = JSON.parse(execution.stdout) as McpResult | McpResult[];

  return Array.isArray(parsed) ? parsed[0]! : parsed;
};

const runOperation = async (operation: string, target: string): Promise<McpResult> =>
  parseResult(await runCli(installerArgs(operation, target)), operation);

const persistReport = () =>
  writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, { encoding: "utf8" });

beforeAll(async () => {
  if (!enabled) return;
  const root = process.env["ORDINE_WINDOWS_MCP_ACCEPTANCE_ROOT"];
  const configuredNode = process.env["ORDINE_WINDOWS_MCP_NODE_PATH"];
  const configuredCli = process.env["ORDINE_WINDOWS_MCP_CLI_FILE"];
  const configuredApiUrl = process.env["ORDINE_WINDOWS_MCP_API_URL"];
  const token = process.env["ORDINE_WINDOWS_MCP_TOKEN"];
  if (!root || !configuredNode || !configuredCli || !configuredApiUrl || !token) {
    throw new Error("COD-369 MCP acceptance environment is incomplete");
  }
  acceptanceRoot = resolve(root);
  nodePath = resolve(configuredNode);
  cliFile = resolve(configuredCli);
  apiUrl = configuredApiUrl;
  serverName = process.env["ORDINE_WINDOWS_MCP_SERVER_NAME"] ?? "ordine-cod369-acceptance";
  await mkdir(acceptanceRoot, { recursive: true });
  reportPath = join(acceptanceRoot, "mcp-acceptance.json");
  tokenFile = join(acceptanceRoot, ".desktop-token");
  await writeFile(tokenFile, token, { encoding: "utf8", mode: 0o600 });
  report.serverName = serverName;
  report.launch = { command: nodePath, cliFile, apiUrl, tokenTransport: "dynamic-file" };
  await persistReport();
});

describe.skipIf(!enabled)("COD-369 Windows MCP acceptance", () => {
  it.each(targets)(
    "%s supports install, status, protocol doctor, and safe uninstall",
    async (target) => {
      const targetReport: (typeof report.targets)[number] = { target };
      report.targets.push(targetReport);
      let installed = false;

      try {
        targetReport.install = await runOperation("install", target);
        installed = ["installed", "already-installed"].includes(targetReport.install.status);
        expect(installed).toBe(true);

        targetReport.status = await runOperation("status", target);
        expect(targetReport.status.status).toBe("already-installed");
        expect(targetReport.status.evidence?.registered).toBe(true);

        targetReport.doctor = await runOperation("doctor", target);
        expect(targetReport.doctor.status).toBe("healthy");
        expect(targetReport.doctor.evidence).toMatchObject({
          recognized: true,
          planned: true,
          registered: true,
          commandLaunchable: true,
          initialize: true,
          toolsList: true,
          safeToolCall: true,
        });

        targetReport.uninstall = await runOperation("uninstall", target);
        installed = false;
        expect(["removed", "absent"]).toContain(targetReport.uninstall.status);

        targetReport.finalStatus = await runOperation("status", target);
        expect(targetReport.finalStatus.status).toBe("absent");
        expect(targetReport.finalStatus.evidence?.registered).toBe(false);
      } catch (error) {
        targetReport.error =
          error instanceof Error ? (error.stack ?? error.message) : String(error);
        throw error;
      } finally {
        if (installed) {
          const cleanup = await runOperation("uninstall", target).catch(() => null);
          if (cleanup) targetReport.uninstall = cleanup;
        }
        await persistReport();
      }
    },
    90_000,
  );

  it("records all protocol layers without storing the token", async () => {
    expect(report.targets).toHaveLength(targets.length);
    expect(report.targets.every((target) => !target.error)).toBe(true);
    const serialized = JSON.stringify(report);
    expect(serialized).not.toContain(process.env["ORDINE_WINDOWS_MCP_TOKEN"]!);
    expect(report.launch.command).toBe(nodePath);
    expect(report.launch.cliFile).toBe(cliFile);
    expect(report.launch.tokenTransport).toBe("dynamic-file");
    expect(report.launch.command.toLowerCase()).toContain("node");
    await persistReport();
  });
});
