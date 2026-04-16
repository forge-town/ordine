import { getModel, type SettingsResolver } from "@repo/agent";
import type { SettingsDaoInstance } from "@repo/models";

export const createLlmService = (dao: SettingsDaoInstance) => {
  const getSettings: SettingsResolver = async () => {
    const s = await dao.get();
    return { apiKey: s.llmApiKey, model: s.llmModel };
  };

  return {
    getModel: (modelOverride?: string) => getModel(getSettings, modelOverride),
    getSettings,
  };
};
