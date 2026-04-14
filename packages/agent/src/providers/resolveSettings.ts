import { PROVIDER_BASE_URLS } from "./constants";
import type { SettingsResolver, LlmOverride } from "./types";

export const resolveSettings = async (getSettings: SettingsResolver, override?: LlmOverride) => {
  const settings = await getSettings();
  const provider = override?.llmProvider ?? settings.llmProvider;
  const model = override?.llmModel ?? settings.llmModel;
  const apiKey = settings.llmApiKey;
  const baseURL = (PROVIDER_BASE_URLS[provider] ?? PROVIDER_BASE_URLS.kimi) as string;
  return { provider, model, apiKey, baseURL };
};
