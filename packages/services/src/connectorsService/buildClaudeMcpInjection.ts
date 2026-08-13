import type { McpConnectorInjection, McpServerEntry } from "@repo/agent";
import { isMcpConnectorConfig, type ConnectorConfig, type McpConnectorConfig } from "@repo/schemas";

export type ClaudeMcpInjection = McpConnectorInjection;

type ConnectorLike = {
  id: string;
  name: string;
  method: string;
  status: string;
  config: ConnectorConfig;
};

/**
 * Server keys keep only [A-Za-z0-9_-]; everything else becomes _
 * (matches claude's mcp__<server>__ naming).
 */
export const sanitizeServerKey = (name: string): string =>
  name.replaceAll(/[^A-Za-z0-9_-]/g, "_").replaceAll(/^_+|_+$/g, "") || "server";

/** Dedupe same-named keys: append `_` until unique. */
const uniqueServerKey = (base: string, taken: Record<string, unknown>): string =>
  base in taken ? uniqueServerKey(`${base}_`, taken) : base;

const selectedMcpToolNames = ({
  serverKey,
  config,
  selectedTools,
}: {
  serverKey: string;
  config: McpConnectorConfig;
  selectedTools: ReadonlySet<string> | null;
}): string[] => {
  const serverToolPrefix = `mcp__${serverKey}`;
  const availableToolNames =
    config.tools && config.tools.length > 0
      ? config.tools.map((tool) => `${serverToolPrefix}__${tool.name}`)
      : [serverToolPrefix];

  return selectedTools
    ? availableToolNames.filter((toolName) => selectedTools.has(toolName))
    : availableToolNames;
};

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
  selectedToolNames?: readonly string[],
): McpConnectorInjection | null => {
  const mcpServers: Record<string, McpServerEntry> = {};
  const toolNames: string[] = [];
  const selectedTools = selectedToolNames ? new Set(selectedToolNames) : null;
  const selectedToolOwners = new Map<string, string>();
  const takenServerKeys: Record<string, unknown> = {};
  const eligibleConnectors = connectors
    .map((connector) => ({ connector }))
    .filter(({ connector }) => {
      if (connector.method !== "mcp") return false;
      if (connector.status !== "connected") return false;

      return isMcpConnectorConfig(connector.config);
    })
    .sort((a, b) => a.connector.id.localeCompare(b.connector.id))
    .map(({ connector }) => {
      const key = uniqueServerKey(sanitizeServerKey(connector.name), takenServerKeys);
      takenServerKeys[key] = true;

      return { connector, key };
    });

  for (const { connector, key } of eligibleConnectors) {
    const config = connector.config;
    if (!isMcpConnectorConfig(config)) continue;

    const selectedServerTools = selectedMcpToolNames({ serverKey: key, config, selectedTools });
    if (selectedServerTools.length === 0) continue;

    for (const toolName of selectedServerTools) {
      const existingOwner = selectedToolOwners.get(toolName);
      if (existingOwner && existingOwner !== key) {
        throw new Error(`Ambiguous MCP tool selection ${toolName}`);
      }
      selectedToolOwners.set(toolName, key);
    }

    if (config.transport === "stdio") {
      mcpServers[key] = {
        command: config.command,
        ...(config.args ? { args: config.args } : {}),
        ...(config.cwd ? { cwd: config.cwd } : {}),
        ...(config.env ? { env: config.env } : {}),
      };
    } else {
      mcpServers[key] = {
        type: "http",
        url: config.url,
        ...(config.headers ? { headers: config.headers } : {}),
      };
    }

    toolNames.push(...selectedServerTools);
  }

  return Object.keys(mcpServers).length > 0 ? { mcpServers, toolNames } : null;
};

export const buildClaudeMcpInjection = buildMcpConnectorInjection;
