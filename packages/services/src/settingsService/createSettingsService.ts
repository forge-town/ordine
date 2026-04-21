import { createSettingsDao, type DbConnection } from "@repo/models";

export const createSettingsService = (db: DbConnection) => {
  const dao = createSettingsDao(db);

  return {
    get: () => dao.get(),
    update: (...args: Parameters<typeof dao.update>) => dao.update(...args),
  };
};
