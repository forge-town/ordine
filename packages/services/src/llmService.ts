/**
 * LLM Service — thin adapter that binds `@repo/agent` to the app's settingsDao.
 */

import { getModel as getModelRaw, type SettingsResolver } from "@repo/agent";
import type { SettingsEntity } from "@repo/models";

type SettingsDao = {
  get: () => Promise<SettingsEntity>;
};

export const createLlmService = (dao: SettingsDao) => {
  const getSettings: SettingsResolver = async () => {
    const s = await dao.get();
    return { apiKey: s.llmApiKey, model: s.llmModel };
  };

  return {
    getModel: (modelOverride?: string) => getModelRaw(getSettings, modelOverride),
    getSettings,
  };
};
