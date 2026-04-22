import { createSettingsDao, type DbConnection } from "@repo/models";
import { withMeta } from "@repo/schemas";

export const createSettingsService = (db: DbConnection) => {
  const dao = createSettingsDao(db);

  return {
    get: async () => withMeta(await dao.get()),
    update: async (...args: Parameters<typeof dao.update>) => withMeta(await dao.update(...args)),
  };
};
