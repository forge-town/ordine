import { join, normalize } from "node:path";
import { z } from "zod/v4";
import { CapabilitySourceIdSchema, CapabilitySourceScopeSchema } from "@repo/schemas";
import { CapabilityAdapterContextSchema, type CapabilityAdapterContext } from "./capabilitySchemas";

export const CapabilitySkillRootConsumerSchema = z.object({
  source: CapabilitySourceIdSchema,
  supportsFlatFiles: z.boolean(),
});
export type CapabilitySkillRootConsumer = z.infer<typeof CapabilitySkillRootConsumerSchema>;

export const CapabilitySkillRootSchema = z.object({
  scope: CapabilitySourceScopeSchema,
  path: z.string().min(1),
  consumers: z.array(CapabilitySkillRootConsumerSchema).min(1),
});
export type CapabilitySkillRoot = z.infer<typeof CapabilitySkillRootSchema>;

const envPath = (env: CapabilityAdapterContext["env"], name: string): string | undefined => {
  const value = env[name]?.trim();

  return value ? normalize(value) : undefined;
};

const rootKey = (scope: "global" | "workspace", path: string): string => {
  const normalizedPath = normalize(path);

  return `${scope}\0${process.platform === "win32" ? normalizedPath.toLowerCase() : normalizedPath}`;
};

/**
 * Build physical roots with the exact runtimes that consume each root. Shared
 * roots such as .agents/skills are represented once and scanned once.
 */
export const getCapabilitySkillRoots = (input: CapabilityAdapterContext): CapabilitySkillRoot[] => {
  const context = CapabilityAdapterContextSchema.parse(input);
  const roots = new Map<string, CapabilitySkillRoot>();
  const codexHome = envPath(context.env, "CODEX_HOME") ?? join(context.homeDir, ".codex");
  const xdgConfigHome = envPath(context.env, "XDG_CONFIG_HOME") ?? join(context.homeDir, ".config");
  const hermesHome = envPath(context.env, "HERMES_HOME") ?? join(context.homeDir, ".hermes");
  const openclawHome =
    envPath(context.env, "OPENCLAW_STATE_DIR") ?? join(context.homeDir, ".openclaw");
  const kimiCodeHome =
    envPath(context.env, "KIMI_CODE_HOME") ?? join(context.homeDir, ".kimi-code");

  const add = (
    scope: "global" | "workspace",
    path: string,
    source: z.infer<typeof CapabilitySourceIdSchema>,
    supportsFlatFiles: boolean,
  ): void => {
    const normalizedPath = normalize(path);
    const key = rootKey(scope, normalizedPath);
    const existing = roots.get(key);
    if (!existing) {
      roots.set(
        key,
        CapabilitySkillRootSchema.parse({
          scope,
          path: normalizedPath,
          consumers: [{ source, supportsFlatFiles }],
        }),
      );

      return;
    }

    const consumer = existing.consumers.find((entry) => entry.source === source);
    if (consumer) {
      consumer.supportsFlatFiles ||= supportsFlatFiles;

      return;
    }
    existing.consumers.push({ source, supportsFlatFiles });
  };

  const claudeSkills = join(context.homeDir, ".claude", "skills");
  add("global", claudeSkills, "claude-code", false);
  add("global", claudeSkills, "opencode", true);
  add("global", claudeSkills, "kimi-code", true);

  // CODEX_HOME/skills remains a compatibility surface used by existing Codex
  // installations; current Codex also discovers the shared .agents roots.
  add("global", join(codexHome, "skills"), "codex", false);
  add("global", join(context.homeDir, ".codex", "skills"), "kimi-code", true);

  const sharedAgentSkills = join(context.homeDir, ".agents", "skills");
  for (const source of [
    "codex",
    "cursor",
    "openclaw",
    "pi-agent",
    "opencode",
    "kimi-code",
  ] as const) {
    add("global", sharedAgentSkills, source, source === "opencode" || source === "kimi-code");
  }

  add("global", join(context.homeDir, ".cursor", "skills"), "cursor", false);
  add("global", join(hermesHome, "skills"), "hermes", false);
  add("global", join(openclawHome, "skills"), "openclaw", false);
  add("global", join(context.homeDir, ".pi", "agent", "skills"), "pi-agent", false);
  add("global", join(xdgConfigHome, "opencode", "skills"), "opencode", true);
  add("global", join(context.homeDir, ".kimi", "skills"), "kimi-code", true);
  add("global", join(xdgConfigHome, "agents", "skills"), "kimi-code", true);
  add("global", join(kimiCodeHome, "skills"), "kimi-code", true);

  if (context.workspacePath) {
    const workspacePath = normalize(context.workspacePath);
    const workspaceClaudeSkills = join(workspacePath, ".claude", "skills");
    add("workspace", workspaceClaudeSkills, "claude-code", false);
    add("workspace", workspaceClaudeSkills, "opencode", true);
    add("workspace", workspaceClaudeSkills, "kimi-code", true);

    const workspaceAgentSkills = join(workspacePath, ".agents", "skills");
    for (const source of [
      "codex",
      "cursor",
      "openclaw",
      "pi-agent",
      "opencode",
      "kimi-code",
    ] as const) {
      add(
        "workspace",
        workspaceAgentSkills,
        source,
        source === "opencode" || source === "kimi-code",
      );
    }

    add("workspace", join(workspacePath, ".cursor", "skills"), "cursor", false);
    add("workspace", join(workspacePath, "skills"), "openclaw", false);
    add("workspace", join(workspacePath, ".pi", "skills"), "pi-agent", false);
    add("workspace", join(workspacePath, ".opencode", "skills"), "opencode", true);
    add("workspace", join(workspacePath, ".kimi", "skills"), "kimi-code", true);
    add("workspace", join(workspacePath, ".codex", "skills"), "kimi-code", true);
    add("workspace", join(workspacePath, ".kimi-code", "skills"), "kimi-code", true);
  }

  return [...roots.values()].map((root) => CapabilitySkillRootSchema.parse(root));
};
