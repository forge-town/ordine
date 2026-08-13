import { join, normalize } from "node:path";
import {
  CapabilityAdapterContextSchema,
  CapabilityConfigCandidateSchema,
  type CapabilityAdapterContext,
  type CapabilityConfigCandidate,
} from "./capabilitySchemas";

const envPath = (env: CapabilityAdapterContext["env"], name: string): string | undefined => {
  const value = env[name]?.trim();

  return value ? normalize(value) : undefined;
};

const uniqueCandidates = (candidates: CapabilityConfigCandidate[]): CapabilityConfigCandidate[] => {
  const seen = new Set<string>();

  return candidates.filter((candidate) => {
    const key = [candidate.source, candidate.scope, candidate.path, candidate.selector].join("\0");
    if (seen.has(key)) return false;
    seen.add(key);

    return true;
  });
};

/**
 * Known config locations are independent of binary detection. A runtime can be
 * absent from PATH while its reusable MCP configuration is still present.
 */
export const getCapabilityConfigCandidates = (
  input: CapabilityAdapterContext,
): CapabilityConfigCandidate[] => {
  const context = CapabilityAdapterContextSchema.parse(input);
  const workspacePath = context.workspacePath && normalize(context.workspacePath);
  const codexHome = envPath(context.env, "CODEX_HOME") ?? join(context.homeDir, ".codex");
  const xdgConfigHome = envPath(context.env, "XDG_CONFIG_HOME") ?? join(context.homeDir, ".config");
  const openclawConfig =
    envPath(context.env, "OPENCLAW_CONFIG_PATH") ??
    join(
      envPath(context.env, "OPENCLAW_STATE_DIR") ?? join(context.homeDir, ".openclaw"),
      "openclaw.json",
    );
  const hermesHome = envPath(context.env, "HERMES_HOME") ?? join(context.homeDir, ".hermes");
  const kimiCodeHome =
    envPath(context.env, "KIMI_CODE_HOME") ?? join(context.homeDir, ".kimi-code");
  const claudeGlobalConfig = join(context.homeDir, ".claude.json");

  const candidates: CapabilityConfigCandidate[] = [
    {
      source: "claude-code",
      scope: "global",
      path: claudeGlobalConfig,
      selector: "global",
    },
    { source: "codex", scope: "global", path: join(codexHome, "config.toml") },
    {
      source: "cursor",
      scope: "global",
      path: join(context.homeDir, ".cursor", "mcp.json"),
    },
    {
      source: "hermes",
      scope: "global",
      path: join(hermesHome, "config.yaml"),
    },
    { source: "openclaw", scope: "global", path: openclawConfig },
    {
      source: "opencode",
      scope: "global",
      path: join(xdgConfigHome, "opencode", "opencode.json"),
    },
    {
      source: "opencode",
      scope: "global",
      path: join(xdgConfigHome, "opencode", "opencode.jsonc"),
    },
    {
      source: "kimi-code",
      scope: "global",
      path: join(kimiCodeHome, "mcp.json"),
    },
    {
      source: "kimi-code",
      scope: "global",
      path: join(context.homeDir, ".kimi", "mcp.json"),
    },
  ];

  if (workspacePath) {
    candidates.push(
      {
        source: "claude-code",
        scope: "workspace",
        path: claudeGlobalConfig,
        selector: "project-entry",
      },
      {
        source: "claude-code",
        scope: "workspace",
        path: join(workspacePath, ".mcp.json"),
        selector: "workspace-file",
      },
      {
        source: "codex",
        scope: "workspace",
        path: join(workspacePath, ".codex", "config.toml"),
      },
      {
        source: "cursor",
        scope: "workspace",
        path: join(workspacePath, ".cursor", "mcp.json"),
      },
      {
        source: "opencode",
        scope: "workspace",
        path: join(workspacePath, "opencode.json"),
      },
      {
        source: "opencode",
        scope: "workspace",
        path: join(workspacePath, "opencode.jsonc"),
      },
      {
        source: "kimi-code",
        scope: "workspace",
        path: join(workspacePath, ".kimi-code", "mcp.json"),
      },
    );
  }

  return uniqueCandidates(candidates).map((candidate) =>
    CapabilityConfigCandidateSchema.parse(candidate),
  );
};
