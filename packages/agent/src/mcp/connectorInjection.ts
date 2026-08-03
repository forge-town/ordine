export type McpServerEntry =
  | { command: string; args?: string[]; env?: Record<string, string> }
  | { type: "http"; url: string; headers?: Record<string, string> };

export type McpConnectorInjection = {
  mcpServers: Record<string, McpServerEntry>;
  toolNames: readonly string[];
};

export const hasMcpConnectorInjection = (
  injection?: McpConnectorInjection | null,
): injection is McpConnectorInjection =>
  !!injection && Object.keys(injection.mcpServers).length > 0;
