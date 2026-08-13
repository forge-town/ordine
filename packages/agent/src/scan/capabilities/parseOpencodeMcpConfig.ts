import { normalizeMcpServerMap } from "./normalizeMcpServerMap";
import { parseJsonConfig } from "./parseStructuredConfig";

export const parseOpencodeMcpConfig = (raw: string) =>
  parseJsonConfig(raw).map((config) => {
    const mcp = config.mcp;
    if (typeof mcp !== "object" || mcp === null || Array.isArray(mcp)) {
      return normalizeMcpServerMap(mcp);
    }
    const mcpRecord = mcp as Record<string, unknown>;

    return normalizeMcpServerMap(mcpRecord.servers ?? mcpRecord);
  });
