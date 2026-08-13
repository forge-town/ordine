import { normalizeMcpServerMap } from "./normalizeMcpServerMap";
import { parseYamlConfig } from "./parseStructuredConfig";

export const parseHermesMcpConfig = (raw: string) =>
  parseYamlConfig(raw).map((config) => normalizeMcpServerMap(config.mcp_servers));
