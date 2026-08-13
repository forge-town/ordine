import { normalizeMcpServerMap } from "./normalizeMcpServerMap";
import { parseJsonConfig } from "./parseStructuredConfig";

export const parseOpenclawMcpConfig = (raw: string) =>
  parseJsonConfig(raw).map((config) => {
    const mcp = config.mcp;
    if (typeof mcp !== "object" || mcp === null || Array.isArray(mcp)) {
      return normalizeMcpServerMap(undefined);
    }

    return normalizeMcpServerMap((mcp as Record<string, unknown>).servers);
  });
