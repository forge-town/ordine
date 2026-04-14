import type { MastraModelConfig } from "@mastra/core/llm";
import { resolveSettings } from "./resolveSettings";
import { DEFAULT_HEADERS, PROVIDER_MASTRA_PREFIX } from "./constants";
import type { SettingsResolver, LlmOverride } from "./types";
import { logger } from "../logger";

export const getMastraModelConfig = async (
  getSettings: SettingsResolver,
  override?: LlmOverride,
): Promise<MastraModelConfig | null> => {
  const { provider, model, apiKey, baseURL } = await resolveSettings(getSettings, override);

  if (!apiKey) {
    logger.warn("No API key configured — agent calls will be skipped");
    return null;
  }

  const prefix = PROVIDER_MASTRA_PREFIX[provider] ?? "kimi-for-coding";
  const modelId = `${prefix}/${model}` as const;
  logger.info({ modelId, baseURL }, "Resolved Mastra model config");

  return {
    id: modelId as `${string}/${string}`,
    url: baseURL,
    apiKey,
    headers: DEFAULT_HEADERS,
  };
};
