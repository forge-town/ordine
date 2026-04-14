/**
 * LLM Service — thin adapter that binds `@repo/agent` to the app's settingsDao.
 */

import type { MastraModelConfig } from "@mastra/core/llm";
import {
  getStreamModel as getStreamModelRaw,
  getModelConfig as getModelConfigRaw,
  type SettingsResolver,
} from "@repo/agent";
import { settingsDao } from "@/models/daos/settingsDao";

export type { MastraModelConfig };

const getSettings: SettingsResolver = async () => {
  const s = await settingsDao.get();
  return { apiKey: s.llmApiKey, model: s.llmModel };
};

export const getStreamModel = (modelOverride?: string) =>
  getStreamModelRaw(getSettings, modelOverride);

export const getModelConfig = (modelOverride?: string): Promise<MastraModelConfig | null> =>
  getModelConfigRaw(getSettings, modelOverride);
