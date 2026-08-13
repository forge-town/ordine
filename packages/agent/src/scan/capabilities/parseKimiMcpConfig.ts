import { normalizeMcpServerMap } from "./normalizeMcpServerMap";
import { parseJsonConfig } from "./parseStructuredConfig";

export const parseKimiMcpConfig = (raw: string) =>
  parseJsonConfig(raw).map((config) => normalizeMcpServerMap(config.mcpServers));
