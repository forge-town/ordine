/**
 * LLM Service — thin adapter that binds `@repo/agent` to the app's settingsDao.
 */

import { getModel as getModelRaw, type SettingsResolver } from "@repo/agent";
import type { SettingsDaoInstance } from "@repo/models";

export const createLlmService = (dao: SettingsDaoInstance) => {
  const getSettings: SettingsResolver = async () => {
    const s = await dao.get();
    return { apiKey: s.llmApiKey, model: s.llmModel };
  };

  return {
    getModel: (modelOverride?: string) => getModelRaw(getSettings, modelOverride),
    getSettings,
  };
};
