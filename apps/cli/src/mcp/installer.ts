import { spawn } from "node:child_process";
import { access, copyFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, extname } from "node:path";
import { Result, ResultAsync } from "neverthrow";
import {
  planMcpInstall,
  type CliInstallPlan,
  type JsonInstallPlan,
  type McpInstallPlan,
  type McpLaunchSpec,
  type McpTargetId,
  type InstallContext,
} from "./installRegistry";
import { probeMcpProtocol, type McpProtocolEvidence } from "./protocolDoctor";

type UnknownRecord = Record<string, unknown>;
type CommandResult = { exitCode: number | null; stdout: string; stderr: string };
export type CommandRunner = (bin: string, args: readonly string[]) => Promise<CommandResult>;

export type McpInstallResult = {
  target: McpTargetId;
  displayName: string;
  support: "supported" | "experimental";
  operation: "install" | "uninstall" | "status" | "doctor" | "print-config";
  status:
    | "installed"
    | "removed"
    | "already-installed"
    | "absent"
    | "healthy"
    | "drifted"
    | "manual"
    | "planned";
  message: string;
  configPath?: string;
  backupPath?: string;
  snippet?: string;
  command?: string;
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

const parseJson = Result.fromThrowable(JSON.parse, (error) =>
  error instanceof Error ? error : new Error(String(error)),
);

const isRecord = (value: unknown): value is UnknownRecord =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const parseJsonObject = (text: string | null, path: string): UnknownRecord => {
  if (text === null || text.trim() === "") return {};
  const parsed = parseJson(text);
  if (parsed.isErr())
    throw new Error(`Existing config at ${path} is invalid JSON: ${parsed.error.message}`);
  if (!isRecord(parsed.value)) throw new Error(`Existing config at ${path} is not a JSON object`);

  return parsed.value;
};

const stableValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!isRecord(value)) return value;

  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, stableValue(item)]),
  );
};

const valuesEqual = (left: unknown, right: unknown): boolean =>
  JSON.stringify(stableValue(left)) === JSON.stringify(stableValue(right));

const serverMap = (
  root: UnknownRecord,
  plan: JsonInstallPlan,
  create: boolean,
): UnknownRecord | null => {
  const state = { cursor: root };
  for (const key of plan.keyPath) {
    const next = state.cursor[key];
    if (!isRecord(next)) {
      if (!create) return null;
      state.cursor[key] = {};
    }
    state.cursor = state.cursor[key] as UnknownRecord;
  }

  return state.cursor;
};

export const inspectJsonInstall = (
  existingText: string | null,
  plan: JsonInstallPlan,
): "absent" | "installed" | "drifted" => {
  const root = parseJsonObject(existingText, plan.configPath);
  const map = serverMap(root, plan, false);
  if (!map || !(plan.serverKey in map)) return "absent";

  return valuesEqual(map[plan.serverKey], plan.entry) ? "installed" : "drifted";
};

export const applyJsonInstall = (existingText: string | null, plan: JsonInstallPlan): string => {
  const root = parseJsonObject(existingText, plan.configPath);
  const map = serverMap(root, plan, true);
  if (!map) throw new Error(`Could not create MCP server map in ${plan.configPath}`);
  if (plan.serverKey in map && !valuesEqual(map[plan.serverKey], plan.entry)) {
    throw new Error(
      `Refusing to overwrite non-ORDINE entry "${plan.serverKey}" in ${plan.configPath}`,
    );
  }
  map[plan.serverKey] = plan.entry;

  return `${JSON.stringify(root, null, 2)}\n`;
};

export const removeJsonInstall = (
  existingText: string | null,
  plan: JsonInstallPlan,
): string | null => {
  if (existingText === null || existingText.trim() === "") return null;
  const root = parseJsonObject(existingText, plan.configPath);
  const map = serverMap(root, plan, false);
  if (!map || !(plan.serverKey in map)) return null;
  if (!valuesEqual(map[plan.serverKey], plan.entry)) {
    throw new Error(`Refusing to remove changed entry "${plan.serverKey}" from ${plan.configPath}`);
  }
  delete map[plan.serverKey];

  return `${JSON.stringify(root, null, 2)}\n`;
};

const readOptionalText = async (path: string): Promise<string | null> => {
  const result = await ResultAsync.fromPromise(readFile(path, "utf8"), (error) => error);
  if (result.isOk()) return result.value;
  const code = isRecord(result.error) ? result.error["code"] : undefined;
  if (code === "ENOENT") return null;
  throw result.error;
};

const timestamp = (): string => new Date().toISOString().replaceAll(/[:.]/g, "-");

const writeJsonConfig = async (
  path: string,
  text: string,
  hadExistingFile: boolean,
): Promise<string | undefined> => {
  await mkdir(dirname(path), { recursive: true });
  const backupPath = hadExistingFile ? `${path}.ordine-backup-${timestamp()}` : undefined;
  if (backupPath) await copyFile(path, backupPath);
  const temporaryPath = `${path}.ordine-${process.pid}-${crypto.randomUUID()}.tmp`;
  await writeFile(temporaryPath, text, { encoding: "utf8", mode: 0o600 });
  await rename(temporaryPath, path);

  return backupPath;
};

const spawnInstallCommand: CommandRunner = (bin, args) =>
  new Promise((resolve) => {
    const child = spawn(bin, args, {
      windowsHide: true,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.on("error", (error) => resolve({ exitCode: null, stdout: "", stderr: error.message }));
    child.on("close", (exitCode) =>
      resolve({
        exitCode,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      }),
    );
  });

const existingPath = async (path: string): Promise<boolean> => {
  const result = await ResultAsync.fromPromise(access(path), () => undefined);

  return result.isOk();
};

const windowsCommand = async (
  bin: string,
  args: readonly string[],
): Promise<{ bin: string; args: readonly string[] }> => {
  if (process.platform !== "win32" || dirname(bin) !== ".") return { bin, args };
  const located = await spawnInstallCommand("where.exe", [bin]);
  if (located.exitCode !== 0) return { bin, args };
  const candidates = located.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const resolved =
    candidates.find((candidate) => extname(candidate).toLowerCase() === ".exe") ??
    candidates.find((candidate) => [".cmd", ".bat"].includes(extname(candidate).toLowerCase())) ??
    candidates[0];
  if (!resolved) return { bin, args };
  if (![".cmd", ".bat"].includes(extname(resolved).toLowerCase())) {
    return { bin: resolved, args };
  }
  const powershellShim = resolved.replace(/\.(?:cmd|bat)$/i, ".ps1");
  if (!(await existingPath(powershellShim))) {
    return {
      bin,
      args,
    };
  }

  return {
    bin: "powershell.exe",
    args: [
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      powershellShim,
      ...args,
    ],
  };
};

export const runInstallCommand: CommandRunner = async (bin, args) => {
  const command = await windowsCommand(bin, args);

  return spawnInstallCommand(command.bin, command.args);
};

type RegistrationState = "absent" | "installed" | "drifted";

const cliRegistrationState = (plan: CliInstallPlan, result: CommandResult): RegistrationState => {
  if (result.exitCode !== 0) return "absent";
  const output = `${result.stdout}\n${result.stderr}`;
  if (plan.verifyOutputIncludes && !output.includes(plan.verifyOutputIncludes)) return "absent";
  if (plan.ownershipMarkers?.some((marker) => !output.includes(marker))) return "drifted";

  return "installed";
};

const commandText = (plan: CliInstallPlan, args: readonly string[]): string =>
  [plan.bin, ...args].map((part) => (part.includes(" ") ? JSON.stringify(part) : part)).join(" ");

const manualResult = (
  plan: Extract<McpInstallPlan, { kind: "manual" }>,
  operation: McpInstallResult["operation"],
): McpInstallResult => ({
  target: plan.target,
  displayName: plan.displayName,
  support: plan.support,
  operation,
  status: "manual",
  message: plan.reason,
  ...(plan.configPath ? { configPath: plan.configPath } : {}),
  snippet: plan.snippet,
});

export const installMcpTarget = async ({
  target,
  spec,
  context,
  dryRun = false,
  commandRunner = runInstallCommand,
}: {
  target: McpTargetId;
  spec: McpLaunchSpec;
  context: InstallContext;
  dryRun?: boolean;
  commandRunner?: CommandRunner;
}): Promise<McpInstallResult> => {
  const plan = planMcpInstall(target, spec, context);
  if (plan.kind === "manual") return manualResult(plan, "install");
  if (plan.kind === "cli") {
    if (dryRun) {
      return {
        target,
        displayName: plan.displayName,
        support: plan.support,
        operation: "install",
        status: "planned",
        message: "CLI registration was not executed because --dry-run is active.",
        command: commandText(plan, plan.addArgs),
      };
    }
    const current = await commandRunner(plan.bin, plan.getArgs);
    const currentState = cliRegistrationState(plan, current);
    if (currentState === "installed") {
      return {
        target,
        displayName: plan.displayName,
        support: plan.support,
        operation: "install",
        status: "already-installed",
        message: `${context.serverName} is already registered.`,
      };
    }
    if (currentState === "drifted") {
      throw new Error(
        `Refusing to overwrite changed entry "${context.serverName}" in ${plan.displayName}`,
      );
    }
    const added = await commandRunner(plan.bin, plan.addArgs);
    if (added.exitCode !== 0) {
      throw new Error(
        `Failed to install ${plan.displayName}: ${added.stderr.trim() || `exit ${added.exitCode}`}`,
      );
    }
    const verified = await commandRunner(plan.bin, plan.getArgs);
    if (cliRegistrationState(plan, verified) !== "installed") {
      throw new Error(
        `Installed ${plan.displayName}, but could not verify ${context.serverName}: ${verified.stderr.trim() || `exit ${verified.exitCode}`}`,
      );
    }

    return {
      target,
      displayName: plan.displayName,
      support: plan.support,
      operation: "install",
      status: "installed",
      message: `${context.serverName} registered through ${plan.bin}.`,
      command: commandText(plan, plan.addArgs),
    };
  }

  const existing = await readOptionalText(plan.configPath);
  const status = inspectJsonInstall(existing, plan);
  if (status === "installed") {
    return {
      target,
      displayName: plan.displayName,
      support: plan.support,
      operation: "install",
      status: "already-installed",
      message: `${context.serverName} already matches the expected config.`,
      configPath: plan.configPath,
    };
  }
  const next = applyJsonInstall(existing, plan);
  if (dryRun) {
    return {
      target,
      displayName: plan.displayName,
      support: plan.support,
      operation: "install",
      status: "planned",
      message: "JSON config was not changed because --dry-run is active.",
      configPath: plan.configPath,
      snippet: next,
    };
  }
  const backupPath = await writeJsonConfig(plan.configPath, next, existing !== null);
  const verified = await readOptionalText(plan.configPath);
  if (inspectJsonInstall(verified, plan) !== "installed") {
    throw new Error(`Wrote ${plan.displayName} config, but could not verify the ORDINE entry`);
  }

  return {
    target,
    displayName: plan.displayName,
    support: plan.support,
    operation: "install",
    status: "installed",
    message: `${context.serverName} merged without replacing sibling config.`,
    configPath: plan.configPath,
    ...(backupPath ? { backupPath } : {}),
  };
};

export const uninstallMcpTarget = async ({
  target,
  spec,
  context,
  dryRun = false,
  commandRunner = runInstallCommand,
}: {
  target: McpTargetId;
  spec: McpLaunchSpec;
  context: InstallContext;
  dryRun?: boolean;
  commandRunner?: CommandRunner;
}): Promise<McpInstallResult> => {
  const plan = planMcpInstall(target, spec, context);
  if (plan.kind === "manual") return manualResult(plan, "uninstall");
  if (plan.kind === "cli") {
    if (dryRun) {
      return {
        target,
        displayName: plan.displayName,
        support: plan.support,
        operation: "uninstall",
        status: "planned",
        message: "CLI removal was not executed because --dry-run is active.",
        command: commandText(plan, plan.removeArgs),
      };
    }
    const current = await commandRunner(plan.bin, plan.getArgs);
    const currentState = cliRegistrationState(plan, current);
    if (currentState === "absent") {
      return {
        target,
        displayName: plan.displayName,
        support: plan.support,
        operation: "uninstall",
        status: "absent",
        message: `${context.serverName} is not registered.`,
      };
    }
    if (currentState === "drifted") {
      throw new Error(
        `Refusing to remove changed entry "${context.serverName}" from ${plan.displayName}`,
      );
    }
    const removed = await commandRunner(plan.bin, plan.removeArgs);
    if (removed.exitCode !== 0) {
      throw new Error(
        `Failed to uninstall ${plan.displayName}: ${removed.stderr.trim() || `exit ${removed.exitCode}`}`,
      );
    }
    const verified = await commandRunner(plan.bin, plan.getArgs);
    if (cliRegistrationState(plan, verified) !== "absent") {
      throw new Error(`Removed ${plan.displayName}, but ${context.serverName} is still registered`);
    }

    return {
      target,
      displayName: plan.displayName,
      support: plan.support,
      operation: "uninstall",
      status: "removed",
      message: `${context.serverName} removed through ${plan.bin}.`,
    };
  }

  const existing = await readOptionalText(plan.configPath);
  const next = removeJsonInstall(existing, plan);
  if (next === null) {
    return {
      target,
      displayName: plan.displayName,
      support: plan.support,
      operation: "uninstall",
      status: "absent",
      message: `${context.serverName} is not present.`,
      configPath: plan.configPath,
    };
  }
  if (dryRun) {
    return {
      target,
      displayName: plan.displayName,
      support: plan.support,
      operation: "uninstall",
      status: "planned",
      message: "JSON config was not changed because --dry-run is active.",
      configPath: plan.configPath,
      snippet: next,
    };
  }
  const backupPath = await writeJsonConfig(plan.configPath, next, true);
  const verified = await readOptionalText(plan.configPath);
  if (inspectJsonInstall(verified, plan) !== "absent") {
    throw new Error(`Wrote ${plan.displayName} config, but the ORDINE entry is still present`);
  }

  return {
    target,
    displayName: plan.displayName,
    support: plan.support,
    operation: "uninstall",
    status: "removed",
    message: `${context.serverName} removed; sibling config was preserved.`,
    configPath: plan.configPath,
    ...(backupPath ? { backupPath } : {}),
  };
};

export const doctorMcpTarget = async ({
  target,
  spec,
  context,
  commandRunner = runInstallCommand,
  protocolProbe = probeMcpProtocol,
}: {
  target: McpTargetId;
  spec: McpLaunchSpec;
  context: InstallContext;
  commandRunner?: CommandRunner;
  protocolProbe?: (spec: McpLaunchSpec) => Promise<McpProtocolEvidence>;
}): Promise<McpInstallResult> => {
  const plan = planMcpInstall(target, spec, context);
  if (plan.kind === "manual") return manualResult(plan, "doctor");
  const registration = await (async (): Promise<{
    state: RegistrationState;
    message: string;
    configPath?: string;
  }> => {
    if (plan.kind !== "cli") {
      const state = inspectJsonInstall(await readOptionalText(plan.configPath), plan);

      return {
        state,
        message:
          state === "installed"
            ? `${context.serverName} matches the expected config.`
            : state === "drifted"
              ? `${context.serverName} exists but differs from the expected ORDINE launch spec.`
              : `${context.serverName} is not configured.`,
        configPath: plan.configPath,
      };
    }
    const current = await commandRunner(plan.bin, plan.getArgs);
    const state = cliRegistrationState(plan, current);

    return {
      state,
      message:
        state === "installed"
          ? `${context.serverName} is registered through ${plan.bin}.`
          : state === "drifted"
            ? `${context.serverName} exists in ${plan.displayName} but its launch command differs from ORDINE.`
            : current.stderr.trim() ||
              `${context.serverName} is not registered through ${plan.bin}.`,
    };
  })();
  const registrationState = registration.state;
  const registrationMessage = registration.message;
  const configPath = registration.configPath;

  if (registrationState !== "installed") {
    return {
      target,
      displayName: plan.displayName,
      support: plan.support,
      operation: "doctor",
      status: registrationState,
      message: registrationMessage,
      ...(configPath ? { configPath } : {}),
      evidence: {
        recognized: true,
        planned: true,
        registered: false,
        commandLaunchable: false,
        initialize: false,
        toolsList: false,
        safeToolCall: false,
      },
    };
  }
  const protocol = await protocolProbe(spec);
  const healthy =
    protocol.commandLaunchable &&
    protocol.initialize &&
    protocol.toolsList &&
    protocol.safeToolCall;

  return {
    target,
    displayName: plan.displayName,
    support: plan.support,
    operation: "doctor",
    status: healthy ? "healthy" : "drifted",
    message: healthy
      ? `${registrationMessage} initialize, tools/list, and ordine.list_jobs all succeeded.`
      : `${registrationMessage} Protocol doctor failed: ${protocol.message ?? "unknown layer"}`,
    ...(configPath ? { configPath } : {}),
    evidence: {
      recognized: true,
      planned: true,
      registered: true,
      commandLaunchable: protocol.commandLaunchable,
      initialize: protocol.initialize,
      toolsList: protocol.toolsList,
      safeToolCall: protocol.safeToolCall,
      toolCount: protocol.toolCount,
    },
  };
};

export const statusMcpTarget = async ({
  target,
  spec,
  context,
  commandRunner = runInstallCommand,
}: {
  target: McpTargetId;
  spec: McpLaunchSpec;
  context: InstallContext;
  commandRunner?: CommandRunner;
}): Promise<McpInstallResult> => {
  const plan = planMcpInstall(target, spec, context);
  if (plan.kind === "manual") return manualResult(plan, "status");
  const registrationState =
    plan.kind === "cli"
      ? cliRegistrationState(plan, await commandRunner(plan.bin, plan.getArgs))
      : inspectJsonInstall(await readOptionalText(plan.configPath), plan);
  const registered = registrationState === "installed";

  return {
    target,
    displayName: plan.displayName,
    support: plan.support,
    operation: "status",
    status: registered ? "already-installed" : registrationState,
    message: registered
      ? `${context.serverName} is registered; protocol health was not tested.`
      : registrationState === "drifted"
        ? `${context.serverName} exists but differs from the expected ORDINE launch spec.`
        : `${context.serverName} is not registered with the expected launch spec.`,
    ...(plan.kind === "json" ? { configPath: plan.configPath } : {}),
    evidence: {
      recognized: true,
      planned: true,
      registered,
      commandLaunchable: false,
      initialize: false,
      toolsList: false,
      safeToolCall: false,
    },
  };
};

export const printMcpTargetConfig = ({
  target,
  spec,
  context,
}: {
  target: McpTargetId;
  spec: McpLaunchSpec;
  context: InstallContext;
}): McpInstallResult => {
  const plan = planMcpInstall(target, spec, context);
  if (plan.kind === "manual") return manualResult(plan, "print-config");
  if (plan.kind === "cli") {
    return {
      target,
      displayName: plan.displayName,
      support: plan.support,
      operation: "print-config",
      status: "planned",
      message: "Agent-owned registration command.",
      command: commandText(plan, plan.addArgs),
    };
  }

  return {
    target,
    displayName: plan.displayName,
    support: plan.support,
    operation: "print-config",
    status: "planned",
    message: "Deletion-safe JSON merge target.",
    configPath: plan.configPath,
    snippet: applyJsonInstall(null, plan),
  };
};
