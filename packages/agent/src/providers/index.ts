import { createAnthropic } from "@ai-sdk/anthropic";
import { logger } from "../logger";

const KIMI_BASE_URL = "https://api.kimi.com/coding/v1";

export interface KimiSettings {
  apiKey: string;
  model: string;
}

export type SettingsResolver = () => Promise<KimiSettings>;

export const getModel = async (getSettings: SettingsResolver, modelOverride?: string) => {
  const { apiKey, model } = await getSettings();
  if (!apiKey) {
    logger.warn("No Kimi API key configured");
    return null;
  }
  const finalModel = modelOverride ?? model;
  logger.info({ model: finalModel }, "Creating Kimi model via Anthropic SDK");
  return createAnthropic({ baseURL: KIMI_BASE_URL, apiKey })(finalModel);
};
