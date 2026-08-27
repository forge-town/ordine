import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import type { Command } from "commander";
import {
  doctorMcpTarget,
  installMcpTarget,
  printMcpTargetConfig,
  statusMcpTarget,
  uninstallMcpTarget,
  type McpInstallResult,
} from "./installer";
import {
  FORMAL_MCP_TARGET_IDS,
  parseFormalMcpTargetId,
  type InstallContext,
  type McpLaunchSpec,
} from "./installRegistry";
import { McpPolicyModeSchema } from "./policy";
import { startMcpServer } from "./server";

type OutputOptions = { json?: boolean };
type InstallOptions = {
  dryRun?: boolean;
  serverName: string;
  policy: string;
  allowWrite?: boolean;
  allowIrreversible?: boolean;
  command?: string;
  cliFile?: string;
  sidecar?: string;
  env: string[];
};

const collect = (value: string, previous: string[]): string[] => [...previous, value];

const installContext = (serverName: string): InstallContext => ({
  home: homedir(),
  cwd: process.cwd(),
  platform: process.platform,
  ...(process.env.APPDATA ? { appData: process.env.APPDATA } : {}),
  serverName,
});

const parseEnvironment = (entries: readonly string[]): Record<string, string> =>
  Object.fromEntries(
    entries.map((entry) => {
      const separator = entry.indexOf("=");
      if (separator < 1) throw new Error(`Invalid --env value "${entry}"; expected KEY=VALUE`);

      return [entry.slice(0, separator), entry.slice(separator + 1)];
    }),
  );

const launchSpec = (options: InstallOptions): McpLaunchSpec => {
  const policy = McpPolicyModeSchema.parse(options.policy);
  const serverArgs = [
    "--policy",
    policy,
    ...(options.allowWrite ? ["--allow-write"] : []),
    ...(options.allowIrreversible ? ["--allow-irreversible"] : []),
  ];
  const tokenFile = join(homedir(), ".ordine", ".desktop-token");
  if (options.sidecar) {
    return {
      command: resolve(options.sidecar),
      args: serverArgs,
      env: {
        ORDINE_DESKTOP_AUTH_TOKEN_FILE: tokenFile,
        ...parseEnvironment(options.env),
      },
    };
  }
  const command = options.command ?? process.execPath;
  const cliFile = options.cliFile ?? process.argv[1];
  if (!cliFile) throw new Error("Could not resolve the ORDINE CLI entry file");

  return {
    command: isAbsolute(command) ? command : resolve(command),
    args: [resolve(cliFile), "mcp", "serve", ...serverArgs],
    env: {
      ORDINE_DESKTOP_AUTH_TOKEN_FILE: tokenFile,
      ...parseEnvironment(options.env),
    },
  };
};

const renderResult = (result: McpInstallResult, output: OutputOptions): void => {
  if (output.json) {
    console.log(JSON.stringify(result));

    return;
  }
  console.log(`${result.displayName}: ${result.status}`);
  console.log(result.message);
  if (result.configPath) console.log(`Config: ${result.configPath}`);
  if (result.backupPath) console.log(`Backup: ${result.backupPath}`);
  if (result.command) console.log(`Command: ${result.command}`);
  if (result.evidence) {
    console.log(
      `Evidence: registered=${result.evidence.registered} launch=${result.evidence.commandLaunchable} initialize=${result.evidence.initialize} tools/list=${result.evidence.toolsList} safe-call=${result.evidence.safeToolCall}`,
    );
    const readiness = [
      typeof result.evidence.apiReachable === "boolean"
        ? `api=${result.evidence.apiReachable}`
        : null,
      typeof result.evidence.dbReachable === "boolean" ? `db=${result.evidence.dbReachable}` : null,
      typeof result.evidence.runtimeCatalogInitialized === "boolean"
        ? `runtime-catalog=${result.evidence.runtimeCatalogInitialized}`
        : null,
      result.evidence.writePolicy ? `write-policy=${result.evidence.writePolicy}` : null,
      result.evidence.failureLayer ? `failure-layer=${result.evidence.failureLayer}` : null,
    ].filter((item): item is string => item !== null);
    if (readiness.length > 0) console.log(`Readiness: ${readiness.join(" ")}`);
  }
  if (result.snippet) console.log(`\n${result.snippet}`);
};

const addInstallerOptions = (command: Command): Command =>
  command
    .option("--dry-run", "Show the planned change without writing or spawning")
    .option("--server-name <name>", "MCP server registration name", "ordine")
    .option("--policy <mode>", "MCP policy: safe or yolo", "safe")
    .option("--allow-write", "Allow reversible write tools in safe mode")
    .option("--allow-irreversible", "Allow delete/irreversible tools in safe mode")
    .option(
      "--command <path>",
      "Absolute Node-compatible runtime path (defaults to process.execPath)",
    )
    .option("--cli-file <path>", "Absolute ORDINE CLI JavaScript file (defaults to current entry)")
    .option("--sidecar <path>", "Absolute standalone ordine-mcp sidecar path")
    .option("--env <KEY=VALUE>", "Environment passed to the MCP server", collect, []);

export const registerMcpCommands = (program: Command, outputOptions: () => OutputOptions): void => {
  const mcp = program.command("mcp").description("Serve and register the ORDINE MCP server");

  mcp
    .command("serve")
    .description("Run the ORDINE stdio MCP server")
    .option("--policy <mode>", "MCP policy: safe or yolo", "safe")
    .option("--allow-write", "Allow reversible write tools in safe mode")
    .option("--allow-irreversible", "Allow delete/irreversible tools in safe mode")
    .action((options: { policy: string; allowWrite?: boolean; allowIrreversible?: boolean }) =>
      startMcpServer({
        mode: McpPolicyModeSchema.parse(options.policy),
        allowWrite: options.allowWrite === true,
        allowIrreversible: options.allowIrreversible === true,
      }),
    );

  addInstallerOptions(
    mcp.command("install <target>").description("Install ORDINE MCP into a coding agent"),
  ).action(async (targetValue: string, options: InstallOptions) => {
    const target = parseFormalMcpTargetId(targetValue);
    const result = await installMcpTarget({
      target,
      spec: launchSpec(options),
      context: installContext(options.serverName),
      dryRun: options.dryRun,
    });
    renderResult(result, outputOptions());
  });

  addInstallerOptions(
    mcp.command("uninstall <target>").description("Remove only the owned ORDINE MCP entry"),
  ).action(async (targetValue: string, options: InstallOptions) => {
    const target = parseFormalMcpTargetId(targetValue);
    const result = await uninstallMcpTarget({
      target,
      spec: launchSpec(options),
      context: installContext(options.serverName),
      dryRun: options.dryRun,
    });
    renderResult(result, outputOptions());
  });

  addInstallerOptions(
    mcp.command("doctor [target]").description("Run registration and live MCP protocol checks"),
  ).action(async (targetValue: string | undefined, options: InstallOptions) => {
    const targets = targetValue ? [parseFormalMcpTargetId(targetValue)] : FORMAL_MCP_TARGET_IDS;
    const results: McpInstallResult[] = [];
    for (const target of targets) {
      results.push(
        await doctorMcpTarget({
          target,
          spec: launchSpec(options),
          context: installContext(options.serverName),
        }),
      );
    }
    if (outputOptions().json) {
      console.log(JSON.stringify(results));

      return;
    }
    for (const result of results) renderResult(result, {});
  });

  addInstallerOptions(
    mcp.command("status [target]").description("Inspect registration without starting the server"),
  ).action(async (targetValue: string | undefined, options: InstallOptions) => {
    const targets = targetValue ? [parseFormalMcpTargetId(targetValue)] : FORMAL_MCP_TARGET_IDS;
    const results: McpInstallResult[] = [];
    for (const target of targets) {
      results.push(
        await statusMcpTarget({
          target,
          spec: launchSpec(options),
          context: installContext(options.serverName),
        }),
      );
    }
    if (outputOptions().json) {
      console.log(JSON.stringify(results));

      return;
    }
    for (const result of results) renderResult(result, {});
  });

  addInstallerOptions(
    mcp
      .command("print-config <target>")
      .description("Print the exact registration command or snippet"),
  ).action((targetValue: string, options: InstallOptions) => {
    const target = parseFormalMcpTargetId(targetValue);
    renderResult(
      printMcpTargetConfig({
        target,
        spec: launchSpec(options),
        context: installContext(options.serverName),
      }),
      outputOptions(),
    );
  });

  mcp
    .command("targets")
    .description("List the formally supported MCP targets")
    .action(() => {
      if (outputOptions().json) {
        console.log(JSON.stringify(FORMAL_MCP_TARGET_IDS));

        return;
      }
      console.log(FORMAL_MCP_TARGET_IDS.join("\n"));
    });
};

export const registerAgentSetupCommands = (program: Command): void => {
  const agent = program.command("agent").description("Manage native coding-agent runtimes");
  agent
    .command("setup <runtime>")
    .description("Prepare a native runtime companion")
    .action((runtime: string) => {
      if (runtime !== "deepseek-harness") {
        throw new Error(`Unsupported native runtime setup: ${runtime}`);
      }
      throw new Error(
        "DeepSeek Harness profile transport is implemented, but this build does not bundle a signed ORDINE dsh companion package yet.",
      );
    });
};
