import { normalizeMcpServerMap } from "./normalizeMcpServerMap";
import { parseTomlConfig } from "./parseStructuredConfig";

export const parseCodexMcpConfig = (raw: string) =>
  parseTomlConfig(raw).map((config) => normalizeMcpServerMap(config.mcp_servers));
