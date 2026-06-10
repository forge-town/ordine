import { z } from "zod/v4";

export const CONNECTOR_METHOD_ENUM = {
  MCP: "mcp",
  BUILT_IN: "built-in",
  DIRECT_API: "direct-api",
} as const;
export const ConnectorMethodSchema = z.enum(CONNECTOR_METHOD_ENUM);
export type ConnectorMethod = z.infer<typeof ConnectorMethodSchema>;
