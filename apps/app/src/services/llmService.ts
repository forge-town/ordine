/**
 * LLM Service — thin adapter that binds `@repo/agent` to the app's settingsDao.
 */

import { getModel as getModelRaw, type SettingsResolver } from "@repo/agent";
import { settingsDao } from "@repo/models";

const getSettings: SettingsResolver = async () => {
  const s = await settingsDao.get();
  return { apiKey: s.llmApiKey, model: s.llmModel };
};

export const getModel = (modelOverride?: string) => getModelRaw(getSettings, modelOverride);
