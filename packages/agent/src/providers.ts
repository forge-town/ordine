import { createAnthropic } from "@ai-sdk/anthropic";
import { logger } from "@repo/logger";

const KIMI_BASE_URL = "https://api.kimi.com/coding/v1";

export interface KimiSettings {
  apiKey: string;
  model: string;
}

export const getKimiModel = (settings: KimiSettings): any => {
  const { apiKey, model } = settings;
  if (!apiKey) {
    logger.warn("No Kimi API key configured");
    return null;
  }
  logger.info({ model }, "Creating Kimi model");
  return createAnthropic({ baseURL: KIMI_BASE_URL, apiKey })(model);
};
