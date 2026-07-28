import type { McpConnectorInjection, McpServerEntry } from "@repo/agent";
import { isMcpConnectorConfig, type ConnectorConfig } from "@repo/schemas";

export type ClaudeMcpInjection = McpConnectorInjection;

type ConnectorLike = { name: string; method: string; status: string; config: ConnectorConfig };

/**
 * Server keys keep only [A-Za-z0-9_-]; everything else becomes _
 * (matches claude's mcp__<server>__ naming).
 */
export const sanitizeServerKey = (name: string): string =>
  name.replaceAll(/[^A-Za-z0-9_-]/g, "_").replaceAll(/^_+|_+$/g, "") || "server";

/** Dedupe same-named keys: append `_` until unique. */
const uniqueServerKey = (base: string, taken: Record<string, unknown>): string =>
  base in taken ? uniqueServerKey(`${base}_`, taken) : base;

/**
 * Assembles method=mcp, status=connected connectors into the claude CLI
 * injection payload. No usable connector -> returns null (callers then skip
 * --mcp-config entirely). Only mcp connectors that completed a real handshake
 * (connected) are consumed; direct-api/built-in, half-configured, or
 * disconnected ones never reach a run (keeps fake state out of the execution
 * chain).
 */
export const buildMcpConnectorInjection = (
  connectors: ConnectorLike[],
): McpConnectorInjection | null => {
  const mcpServers: Record<string, McpServerEntry> = {};
  const toolNames: string[] = [];

  for (const connector of connectors) {
    if (connector.method !== "mcp") continue;
    if (connector.status !== "connected") continue;
    const config = connector.config;
    if (!isMcpConnectorConfig(config)) continue;

    const key = uniqueServerKey(sanitizeServerKey(connector.name), mcpServers);

    if (config.transport === "stdio") {
      mcpServers[key] = {
        command: config.command,
        ...(config.args ? { args: config.args } : {}),
        ...(config.env ? { env: config.env } : {}),
      };
    } else {
      mcpServers[key] = {
        type: "http",
        url: config.url,
        ...(config.headers ? { headers: config.headers } : {}),
      };
    }

    const tools = config.tools ?? [];
    if (tools.length === 0) {
      toolNames.push(`mcp__${key}`);
    } else {
      for (const tool of tools) toolNames.push(`mcp__${key}__${tool.name}`);
    }
  }

  return Object.keys(mcpServers).length > 0 ? { mcpServers, toolNames } : null;
};

export const buildClaudeMcpInjection = buildMcpConnectorInjection;
