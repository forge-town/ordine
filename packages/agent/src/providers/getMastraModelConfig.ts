import type { MastraModelConfig } from "@mastra/core/llm";
import { resolveSettings } from "./resolveSettings";
import { DEFAULT_HEADERS, PROVIDER_MASTRA_PREFIX } from "./constants";
import type { SettingsResolver, LlmOverride, LogFn } from "./types";
import { noopLog } from "./types";

export const getMastraModelConfig = async (
  getSettings: SettingsResolver,
  override?: LlmOverride,
  log: LogFn = noopLog,
): Promise<MastraModelConfig | null> => {
  const { provider, model, apiKey, baseURL } = await resolveSettings(getSettings, override);

  if (!apiKey) {
    await log(`[Mastra] No API key configured — agent calls will be skipped`);
    return null;
  }

  const prefix = PROVIDER_MASTRA_PREFIX[provider] ?? "kimi-for-coding";
  const modelId = `${prefix}/${model}` as const;
  await log(`[Mastra] Model: ${modelId}, URL: ${baseURL}`);

  return {
    id: modelId as `${string}/${string}`,
    url: baseURL,
    apiKey,
    headers: DEFAULT_HEADERS,
  };
};
