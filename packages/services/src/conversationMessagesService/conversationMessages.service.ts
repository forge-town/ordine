import { createConversationMessagesDao, type DbConnection } from "@repo/models";

import {
  createGetAllMethod,
  createGetByIdMethod,
  createGetByPipelineIdMethod,
  createCreateMethod,
  createUpdateMethod,
  createClearAllMethod,
  createDeleteMethod,
} from "./methods";

export const createConversationMessagesService = (db: DbConnection) => {
  const dao = createConversationMessagesDao(db);

  return {
    getAll: createGetAllMethod(dao),
    getById: createGetByIdMethod(dao),
    getByPipelineId: createGetByPipelineIdMethod(dao),
    create: createCreateMethod(dao),
    update: createUpdateMethod(dao),
    clearAll: createClearAllMethod(dao),
    delete: createDeleteMethod(dao),
  };
};
