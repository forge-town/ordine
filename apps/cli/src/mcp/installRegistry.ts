import { join } from "node:path";
import { z } from "zod";

export const McpTargetIdSchema = z.enum([
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
]);
export type McpTargetId = z.infer<typeof McpTargetIdSchema>;
export const MCP_TARGET_IDS = McpTargetIdSchema.options;
export const FORMAL_MCP_TARGET_IDS = ["codex", "claude", "opencode"] as const;
export type FormalMcpTargetId = (typeof FORMAL_MCP_TARGET_IDS)[number];
export const parseFormalMcpTargetId = (value: string): FormalMcpTargetId => {
  const normalized = value === "claude-code" ? "claude" : value;
  if (FORMAL_MCP_TARGET_IDS.includes(normalized as FormalMcpTargetId)) {
    return normalized as FormalMcpTargetId;
  }

  throw new Error(
    `Unsupported formal MCP target: ${value}. Expected codex, claude (or claude-code), or opencode.`,
  );
};

export type McpLaunchSpec = {
  command: string;
  args: string[];
  env: Record<string, string>;
};

export type InstallContext = {
  home: string;
  cwd: string;
  platform: NodeJS.Platform;
  appData?: string;
  serverName: string;
};

export type CliInstallPlan = {
  kind: "cli";
  target: McpTargetId;
  displayName: string;
  support: "supported";
  bin: string;
  addArgs: string[];
  removeArgs: string[];
  getArgs: string[];
  verifyOutputIncludes?: string;
  ownershipMarkers?: string[];
};

export type JsonInstallPlan = {
  kind: "json";
  target: McpTargetId;
  displayName: string;
  support: "supported";
  configPath: string;
  keyPath: string[];
  serverKey: string;
  entry: unknown;
};

export type ManualInstallPlan = {
  kind: "manual";
  target: McpTargetId;
  displayName: string;
  support: "experimental";
  format: "json" | "yaml" | "toml" | "command";
  configPath: string | null;
  snippet: string;
  reason: string;
};

export type McpInstallPlan = CliInstallPlan | JsonInstallPlan | ManualInstallPlan;

const envFlags = (env: Record<string, string>, flag: string): string[] =>
  Object.entries(env).flatMap(([key, value]) => [flag, `${key}=${value}`]);

const jsonEntry = (
  spec: McpLaunchSpec,
  extra: Record<string, unknown> = {},
  envKey: "env" | "environment" = "env",
): Record<string, unknown> => ({
  command: spec.command,
  args: spec.args,
  ...extra,
  ...(Object.keys(spec.env).length > 0 ? { [envKey]: spec.env } : {}),
});

const appDataPath = (context: InstallContext): string =>
  context.appData ?? join(context.home, "AppData", "Roaming");

const clineConfigPath = (context: InstallContext): string => {
  const relative = join(
    "globalStorage",
    "saoudrizwan.claude-dev",
    "settings",
    "cline_mcp_settings.json",
  );
  if (context.platform === "darwin") {
    return join(context.home, "Library", "Application Support", "Code", "User", relative);
  }
  if (context.platform === "win32") {
    return join(appDataPath(context), "Code", "User", relative);
  }

  return join(context.home, ".config", "Code", "User", relative);
};

const traeConfigPath = (context: InstallContext): string => {
  if (context.platform === "darwin") {
    return join(context.home, "Library", "Application Support", "Trae", "User", "mcp.json");
  }
  if (context.platform === "win32") {
    return join(appDataPath(context), "Trae", "User", "mcp.json");
  }

  return join(context.home, ".config", "Trae", "User", "mcp.json");
};

const claudeDesktopConfigPath = (context: InstallContext): string | null => {
  if (context.platform === "darwin") {
    return join(
      context.home,
      "Library",
      "Application Support",
      "Claude",
      "claude_desktop_config.json",
    );
  }
  if (context.platform === "win32") {
    return join(appDataPath(context), "Claude", "claude_desktop_config.json");
  }

  return null;
};

const genericSnippet = (spec: McpLaunchSpec, serverName: string): string =>
  JSON.stringify(
    {
      mcpServers: {
        [serverName]: {
          command: spec.command,
          args: spec.args,
          ...(Object.keys(spec.env).length > 0 ? { env: spec.env } : {}),
        },
      },
    },
    null,
    2,
  );

const hermesSnippet = (spec: McpLaunchSpec, serverName: string): string =>
  [
    "mcp_servers:",
    `  ${serverName}:`,
    `    command: ${JSON.stringify(spec.command)}`,
    `    args: ${JSON.stringify(spec.args)}`,
    ...(Object.keys(spec.env).length === 0
      ? []
      : [
          "    env:",
          ...Object.entries(spec.env).map(
            ([key, value]) => `      ${key}: ${JSON.stringify(value)}`,
          ),
        ]),
  ].join("\n");

const vibeSnippet = (spec: McpLaunchSpec, serverName: string): string =>
  [
    "[[mcp_servers]]",
    `name = ${JSON.stringify(serverName)}`,
    'transport = "stdio"',
    `command = ${JSON.stringify(spec.command)}`,
    `args = [${spec.args.map((arg) => JSON.stringify(arg)).join(", ")}]`,
  ].join("\n");

export const planMcpInstall = (
  target: McpTargetId,
  spec: McpLaunchSpec,
  context: InstallContext,
): McpInstallPlan => {
  const { serverName } = context;
  switch (target) {
    case "claude": {
      return {
        kind: "cli",
        target,
        displayName: "Claude Code",
        support: "supported",
        bin: "claude",
        addArgs: [
          "mcp",
          "add",
          "--scope",
          "user",
          serverName,
          ...envFlags(spec.env, "-e"),
          "--",
          spec.command,
          ...spec.args,
        ],
        removeArgs: ["mcp", "remove", "--scope", "user", serverName],
        getArgs: ["mcp", "get", serverName],
        ownershipMarkers: [spec.command, ...spec.args, ...Object.keys(spec.env)],
      };
    }
    case "codex": {
      return {
        kind: "cli",
        target,
        displayName: "Codex CLI",
        support: "supported",
        bin: "codex",
        addArgs: [
          "mcp",
          "add",
          serverName,
          ...envFlags(spec.env, "--env"),
          "--",
          spec.command,
          ...spec.args,
        ],
        removeArgs: ["mcp", "remove", serverName],
        getArgs: ["mcp", "get", serverName],
        ownershipMarkers: [spec.command, ...spec.args, ...Object.keys(spec.env)],
      };
    }
    case "reasonix": {
      return {
        kind: "cli",
        target,
        displayName: "DeepSeek Reasonix",
        support: "supported",
        bin: "reasonix",
        addArgs: [
          "mcp",
          "add",
          serverName,
          ...envFlags(spec.env, "--env"),
          spec.command,
          ...spec.args,
        ],
        removeArgs: ["mcp", "remove", serverName],
        getArgs: ["mcp", "get", serverName],
      };
    }
    case "kimi": {
      return {
        kind: "cli",
        target,
        displayName: "Kimi CLI",
        support: "supported",
        bin: "kimi",
        addArgs: [
          "mcp",
          "add",
          "--transport",
          "stdio",
          ...envFlags(spec.env, "--env"),
          serverName,
          "--",
          spec.command,
          ...spec.args,
        ],
        removeArgs: ["mcp", "remove", serverName],
        getArgs: ["mcp", "list"],
        verifyOutputIncludes: serverName,
      };
    }
    case "cursor": {
      return {
        kind: "json",
        target,
        displayName: "Cursor",
        support: "supported",
        configPath: join(context.home, ".cursor", "mcp.json"),
        keyPath: ["mcpServers"],
        serverKey: serverName,
        entry: jsonEntry(spec, { type: "stdio" }),
      };
    }
    case "raven": {
      return {
        kind: "json",
        target,
        displayName: "Raven",
        support: "supported",
        configPath: join(context.home, ".raven", "config.json"),
        keyPath: ["tools", "mcpServers"],
        serverKey: serverName,
        entry: { ...jsonEntry(spec, { type: "stdio" }), env: spec.env },
      };
    }
    case "copilot": {
      return {
        kind: "json",
        target,
        displayName: "GitHub Copilot CLI",
        support: "supported",
        configPath: join(context.home, ".copilot", "mcp-config.json"),
        keyPath: ["mcpServers"],
        serverKey: serverName,
        entry: jsonEntry(spec, { type: "local", tools: ["*"] }),
      };
    }
    case "copilot-vscode": {
      return {
        kind: "json",
        target,
        displayName: "VS Code + GitHub Copilot",
        support: "supported",
        configPath: join(context.cwd, ".vscode", "mcp.json"),
        keyPath: ["servers"],
        serverKey: serverName,
        entry: jsonEntry(spec, { type: "stdio" }),
      };
    }
    case "cline": {
      return {
        kind: "json",
        target,
        displayName: "Cline",
        support: "supported",
        configPath: clineConfigPath(context),
        keyPath: ["mcpServers"],
        serverKey: serverName,
        entry: jsonEntry(spec, { disabled: false, autoApprove: [] }),
      };
    }
    case "opencode": {
      return {
        kind: "json",
        target,
        displayName: "OpenCode",
        support: "supported",
        configPath: join(context.home, ".config", "opencode", "opencode.json"),
        keyPath: ["mcp"],
        serverKey: serverName,
        entry: {
          type: "local",
          command: [spec.command, ...spec.args],
          enabled: true,
          ...(Object.keys(spec.env).length > 0 ? { environment: spec.env } : {}),
        },
      };
    }
    case "openclaw": {
      return {
        kind: "json",
        target,
        displayName: "OpenClaw",
        support: "supported",
        configPath: join(context.home, ".openclaw", "openclaw.json"),
        keyPath: ["mcp", "servers"],
        serverKey: serverName,
        entry: jsonEntry(spec),
      };
    }
    case "antigravity": {
      return {
        kind: "json",
        target,
        displayName: "Antigravity",
        support: "supported",
        configPath: join(context.home, ".gemini", "antigravity", "mcp_config.json"),
        keyPath: ["mcpServers"],
        serverKey: serverName,
        entry: jsonEntry(spec),
      };
    }
    case "kiro": {
      return {
        kind: "json",
        target,
        displayName: "Kiro",
        support: "supported",
        configPath: join(context.home, ".kiro", "settings", "mcp.json"),
        keyPath: ["mcpServers"],
        serverKey: serverName,
        entry: jsonEntry(spec),
      };
    }
    case "trae": {
      return {
        kind: "json",
        target,
        displayName: "Trae",
        support: "supported",
        configPath: traeConfigPath(context),
        keyPath: ["mcpServers"],
        serverKey: serverName,
        entry: jsonEntry(spec),
      };
    }
    case "claude-desktop": {
      const configPath = claudeDesktopConfigPath(context);
      if (!configPath) {
        return {
          kind: "manual",
          target,
          displayName: "Claude Desktop",
          support: "experimental",
          format: "json",
          configPath: null,
          snippet: genericSnippet(spec, serverName),
          reason: "Automatic Claude Desktop configuration is supported only on Windows and macOS.",
        };
      }

      return {
        kind: "json",
        target,
        displayName: "Claude Desktop",
        support: "supported",
        configPath,
        keyPath: ["mcpServers"],
        serverKey: serverName,
        entry: jsonEntry(spec, { type: "stdio" }),
      };
    }
    case "deepseek-harness": {
      return {
        kind: "manual",
        target,
        displayName: "DeepSeek Harness",
        support: "experimental",
        format: "command",
        configPath: join(context.home, ".dsh", "profiles", "ordine"),
        snippet: "ordine agent setup deepseek-harness",
        reason:
          "The ORDINE dsh profile transport is implemented, but a signed companion package is not bundled yet. Install a compatible profile before running it.",
      };
    }
    case "pi": {
      return {
        kind: "manual",
        target,
        displayName: "Pi Agent",
        support: "experimental",
        format: "json",
        configPath: join(context.home, ".pi", "agent", "mcp.json"),
        snippet: genericSnippet(spec, serverName),
        reason: "Pi exposes MCP, but its persistent config path and schema are not authoritative.",
      };
    }
    case "vibe": {
      return {
        kind: "manual",
        target,
        displayName: "Mistral Vibe CLI",
        support: "experimental",
        format: "toml",
        configPath: join(context.home, ".vibe", "config.toml"),
        snippet: vibeSnippet(spec, serverName),
        reason:
          "Vibe's TOML MCP schema varies by release; this installer will not rewrite it blindly.",
      };
    }
    case "hermes": {
      return {
        kind: "manual",
        target,
        displayName: "Hermes Agent",
        support: "experimental",
        format: "yaml",
        configPath: join(context.home, ".hermes", "config.yaml"),
        snippet: hermesSnippet(spec, serverName),
        reason:
          "Hermes MCP YAML shape is not authoritative enough for deletion-safe automatic edits.",
      };
    }
    default: {
      const exhaustive: never = target;
      throw new Error(`Unsupported MCP target: ${String(exhaustive)}`);
    }
  }
};
