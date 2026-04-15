import type { SettingsEntity } from "@repo/models";

type SettingsDao = {
  get: () => Promise<SettingsEntity>;
  update: (
    patch: Partial<Pick<SettingsEntity, "llmProvider" | "llmApiKey" | "llmModel">>,
  ) => Promise<SettingsEntity>;
};

export const createSettingsService = (dao: SettingsDao) => ({
  get: () => dao.get(),
  update: (patch: Partial<Pick<SettingsEntity, "llmProvider" | "llmApiKey" | "llmModel">>) =>
    dao.update(patch),
});
