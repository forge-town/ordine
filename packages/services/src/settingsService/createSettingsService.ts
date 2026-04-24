import { createSettingsDao, type DbConnection } from "@repo/models";
import { withMeta } from "@repo/schemas";
import { normalizeSettingsRecord } from "./normalizeSettingsRecord";

export const createSettingsService = (db: DbConnection) => {
  const dao = createSettingsDao(db);

  return {
    get: async () => withMeta(normalizeSettingsRecord(await dao.get())),
    update: async (...args: Parameters<typeof dao.update>) =>
      withMeta(normalizeSettingsRecord(await dao.update(...args))),
  };
};
