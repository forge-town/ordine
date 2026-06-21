import { isMcpConnectorConfig, type ConnectorConfig } from "@repo/schemas";

export type McpServerEntry =
  | { command: string; args?: string[]; env?: Record<string, string> }
  | { type: "http"; url: string; headers?: Record<string, string> };

export type ClaudeMcpInjection = {
  /** 写进 `--mcp-config` 文件的 mcpServers map。 */
  mcpServers: Record<string, McpServerEntry>;
  /** 追加进 --allowedTools 的 `mcp__<server>__<tool>` 名（无 tools 时给 `mcp__<server>` 放行整服）。 */
  toolNames: string[];
};

type ConnectorLike = { name: string; status: string; config: ConnectorConfig };

/** server key 只保留 [A-Za-z0-9_-]，其余转 _（与 claude 的 mcp__<server>__ 命名一致）。 */
export const sanitizeServerKey = (name: string): string =>
  name.replace(/[^A-Za-z0-9_-]/g, "_").replace(/^_+|_+$/g, "") || "server";

/**
 * 把 status=connected 的 mcp connector 装配成 claude CLI 的注入物。
 * 无可用 connector → 返回 null（调用方据此不加 --mcp-config）。
 * 仅消费已握手过（connected）的 connector，半成品/未连不进运行（防假态进执行链）。
 */
export const buildClaudeMcpInjection = (connectors: ConnectorLike[]): ClaudeMcpInjection | null => {
  const mcpServers: Record<string, McpServerEntry> = {};
  const toolNames: string[] = [];

  for (const connector of connectors) {
    if (connector.status !== "connected") continue;
    const config = connector.config;
    if (!isMcpConnectorConfig(config)) continue;

    let key = sanitizeServerKey(connector.name);
    while (key in mcpServers) key = `${key}_`; // 去重，避免同名覆盖

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
