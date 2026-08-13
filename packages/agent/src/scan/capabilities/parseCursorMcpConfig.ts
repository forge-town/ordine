import { normalizeMcpServerMap } from "./normalizeMcpServerMap";
import { parseJsonConfig } from "./parseStructuredConfig";

export const parseCursorMcpConfig = (raw: string) =>
  parseJsonConfig(raw).map((config) => normalizeMcpServerMap(config.mcpServers));
