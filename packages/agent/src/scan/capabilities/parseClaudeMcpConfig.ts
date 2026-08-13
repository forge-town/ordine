import { z } from "zod/v4";
import { posix } from "node:path";
import { normalizeMcpServerMap } from "./normalizeMcpServerMap";
import { parseJsonConfig } from "./parseStructuredConfig";

export const ClaudeMcpSelectorSchema = z.discriminatedUnion("scope", [
  z.object({ scope: z.literal("global") }),
  z.object({ scope: z.literal("workspace"), workspacePath: z.string().min(1).optional() }),
]);
export type ClaudeMcpSelector = z.infer<typeof ClaudeMcpSelectorSchema>;

const projectPathKey = (path: string): string => {
  const normalized = posix.normalize(path.replaceAll("\\", "/"));
  const withoutTrailingSlash = normalized.length > 1 ? normalized.replace(/\/+$/, "") : normalized;

  return process.platform === "win32" || /^[A-Za-z]:\//.test(normalized)
    ? withoutTrailingSlash.toLowerCase()
    : withoutTrailingSlash;
};

export const parseClaudeMcpConfig = (raw: string, selector: ClaudeMcpSelector) =>
  parseJsonConfig(raw).map((config) => {
    if (selector.scope === "global") return normalizeMcpServerMap(config.mcpServers);
    if (!selector.workspacePath) return normalizeMcpServerMap(config.mcpServers);

    const projects = config.projects;
    if (typeof projects !== "object" || projects === null || Array.isArray(projects)) {
      return normalizeMcpServerMap(undefined);
    }
    const workspaceKey = projectPathKey(selector.workspacePath);
    const project = Object.entries(projects as Record<string, unknown>).find(
      ([path]) => projectPathKey(path) === workspaceKey,
    )?.[1];
    if (typeof project !== "object" || project === null || Array.isArray(project)) {
      return normalizeMcpServerMap(undefined);
    }

    return normalizeMcpServerMap((project as Record<string, unknown>).mcpServers);
  });
