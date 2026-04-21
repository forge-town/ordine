import { getModel, type SettingsResolver } from "@repo/agent";
import { createSettingsDao, type DbConnection } from "@repo/models";

export const createLlmService = (db: DbConnection) => {
  const dao = createSettingsDao(db);

  const getSettings: SettingsResolver = async () => {
    const s = await dao.get();

    return { apiKey: s.defaultApiKey, model: s.defaultModel };
  };

  return {
    getModel: (modelOverride?: string) => getModel(getSettings, modelOverride),
    getSettings,
  };
};
