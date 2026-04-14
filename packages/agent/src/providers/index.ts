import { createOpenAI } from "@ai-sdk/openai";
import type { MastraModelConfig } from "@mastra/core/llm";
import { logger } from "../logger";

const KIMI_BASE_URL = "https://api.kimi.com/coding/v1";

export interface KimiSettings {
  apiKey: string;
  model: string;
}

export type SettingsResolver = () => Promise<KimiSettings>;

export const getModelConfig = async (
  getSettings: SettingsResolver,
  modelOverride?: string,
): Promise<MastraModelConfig | null> => {
  const { apiKey, model } = await getSettings();
  if (!apiKey) {
    logger.warn("No Kimi API key configured");
    return null;
  }
  const finalModel = modelOverride ?? model;
  const modelId = `kimi-for-coding/${finalModel}` as `${string}/${string}`;
  logger.info({ modelId }, "Resolved Kimi model config");
  return { id: modelId, url: KIMI_BASE_URL, apiKey };
};

export const getStreamModel = async (getSettings: SettingsResolver, modelOverride?: string) => {
  const { apiKey, model } = await getSettings();
  if (!apiKey) {
    logger.warn("No Kimi API key configured");
    return null;
  }
  const finalModel = modelOverride ?? model;
  logger.info({ model: finalModel }, "Creating Kimi stream model");
  return createOpenAI({ apiKey, baseURL: KIMI_BASE_URL }).chat(finalModel);
};
