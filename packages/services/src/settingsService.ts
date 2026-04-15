import type { SettingsDaoInstance } from "@repo/models";

export const createSettingsService = (dao: SettingsDaoInstance) => ({
  get: () => dao.get(),
  update: (...args: Parameters<typeof dao.update>) => dao.update(...args),
});
