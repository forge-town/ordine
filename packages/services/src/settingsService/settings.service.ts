import { createSettingsDao, type DbConnection } from "@repo/models";

import { createGetMethod, createUpdateMethod } from "./methods";

export const createSettingsService = (db: DbConnection) => {
  const dao = createSettingsDao(db);

  return {
    get: createGetMethod(dao),
    update: createUpdateMethod(dao),
  };
};
