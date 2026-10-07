import { Buffer } from "node:buffer";
import type { McpConnectorInjection, McpServerEntry } from "@repo/agent";
import {
  McpConnectorConfigSchema,
  type ConnectorConfig,
  type McpConnectorConfig,
} from "@repo/schemas";

export type ClaudeMcpInjection = McpConnectorInjection;

export type ConnectorLike = {
  id: string;
  name: string;
  method: string;
  status: string;
  config: ConnectorConfig;
};

export type ResolvedMcpConnector = {
  connector: ConnectorLike;
  config: McpConnectorConfig;
  serverKey: string;
};

export type ResolvedMcpTool = ResolvedMcpConnector & {
  toolName: string;
  description: string;
  reference: string;
};

/**
 * MCP references are persisted on operations, so their server component must
 * not depend on connector display names or on which other connectors happen
 * to be connected. Hex is injective for the UTF-8 connector id and cannot
 * contain the `__` separator used by Claude/Codex tool references.
 */
export const buildMcpServerKey = (connectorId: string): string => {
  if (connectorId.length === 0) throw new Error("MCP connector id must be non-empty");

  return `connector_${Buffer.from(connectorId, "utf8").toString("hex")}`;
};

export const buildMcpToolReference = (serverKey: string, toolName: string): string =>
  `mcp__${serverKey}__${toolName}`;

/**
 * Resolve every connected, structurally valid MCP connector in stable id
 * order. Runtime injection and the capability catalog both consume this
 * function so server-key disambiguation cannot drift between the two paths.
 */
export const resolveMcpConnectors = (connectors: ConnectorLike[]): ResolvedMcpConnector[] => {
  return connectors
    .flatMap((connector) => {
      if (connector.method !== "mcp" || connector.status !== "connected") return [];
      const parsed = McpConnectorConfigSchema.safeParse(connector.config);

      return parsed.success ? [{ connector, config: parsed.data }] : [];
    })
    .sort((a, b) => a.connector.id.localeCompare(b.connector.id))
    .map(({ connector, config }) => ({
      connector,
      config,
      serverKey: buildMcpServerKey(connector.id),
    }));
};

/** Only handshake-discovered concrete tools belong in the public catalog. */
export const resolveMcpConnectorTools = (connectors: ConnectorLike[]): ResolvedMcpTool[] =>
  resolveMcpConnectors(connectors).flatMap((resolved) => {
    const seenToolNames = new Set<string>();

    return (resolved.config.tools ?? []).flatMap((tool) => {
      if (seenToolNames.has(tool.name)) return [];
      seenToolNames.add(tool.name);

      return [
        {
          ...resolved,
          toolName: tool.name,
          description: tool.description ?? "",
          reference: buildMcpToolReference(resolved.serverKey, tool.name),
        },
      ];
    });
  });

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
      ? [...new Set(config.tools.map((tool) => buildMcpToolReference(serverKey, tool.name)))]
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
  const eligibleConnectors = resolveMcpConnectors(connectors);

  for (const { config, serverKey: key } of eligibleConnectors) {
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
