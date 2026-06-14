import { z } from "zod/v4";

/** 握手后从 MCP server 拉到的工具摘要，回填进 connector.config.tools。 */
export const McpToolSummarySchema = z.object({
  name: z.string(),
  description: z.string().optional(),
});
export type McpToolSummary = z.infer<typeof McpToolSummarySchema>;

/** stdio 传输：本地 spawn 一个 MCP server 进程。 */
export const StdioConnectorConfigSchema = z.object({
  transport: z.literal("stdio"),
  command: z.string().min(1),
  args: z.array(z.string()).optional(),
  env: z.record(z.string(), z.string()).optional(),
  tools: z.array(McpToolSummarySchema).optional(),
  lastError: z.string().optional(),
});
export type StdioConnectorConfig = z.infer<typeof StdioConnectorConfigSchema>;

/** http(s)/SSE 传输：远端 MCP server 端点。 */
export const HttpConnectorConfigSchema = z.object({
  transport: z.literal("http"),
  url: z.string().refine((u) => /^https?:\/\//.test(u), { message: "url must be http(s)" }),
  headers: z.record(z.string(), z.string()).optional(),
  tools: z.array(McpToolSummarySchema).optional(),
  lastError: z.string().optional(),
});
export type HttpConnectorConfig = z.infer<typeof HttpConnectorConfigSchema>;

/** 带 transport 的真实 MCP 配置（严格校验）。 */
export const McpConnectorConfigSchema = z.discriminatedUnion("transport", [
  StdioConnectorConfigSchema,
  HttpConnectorConfigSchema,
]);
export type McpConnectorConfig = z.infer<typeof McpConnectorConfigSchema>;

/**
 * 旧行/空 {} 兼容：N22 之前的 connector.config 是空对象或未结构化。
 * 仅接受**不含 transport** 的对象——一旦带了 transport 就必须走严格的 Mcp 分支，
 * 防止"transport:stdio 但缺 command"这类半成品从宽松分支漏过去（假态复发）。
 */
export const LegacyConnectorConfigSchema = z
  .record(z.string(), z.unknown())
  .refine((c) => !("transport" in c), { message: "structured config must use Mcp schema" });

export const ConnectorConfigSchema = z.union([
  McpConnectorConfigSchema,
  LegacyConnectorConfigSchema,
]);
export type ConnectorConfig = z.infer<typeof ConnectorConfigSchema>;

/** 类型守卫：config 是否为已结构化的真实 MCP 配置。 */
export const isMcpConnectorConfig = (config: ConnectorConfig): config is McpConnectorConfig =>
  typeof config === "object" &&
  config !== null &&
  "transport" in config &&
  (config.transport === "stdio" || config.transport === "http");
