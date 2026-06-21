import { ResultAsync, errAsync, okAsync } from "neverthrow";
import { createConversationMessagesDao, type DbConnection } from "@repo/models";
import { NotFoundError, toServiceError } from "../serviceErrors";

export const createConversationMessagesService = (db: DbConnection) => {
  const dao = createConversationMessagesDao(db);

  return {
    getAll: () =>
      ResultAsync.fromPromise(dao.getAll(), (error) =>
        toServiceError(error, "Get conversation messages"),
      ),
    getById: (id: string) =>
      ResultAsync.fromPromise(dao.getById(id), (error) =>
        toServiceError(error, "Get conversation message"),
      ).andThen((message) =>
        message ? okAsync(message) : errAsync(new NotFoundError("ConversationMessage", id)),
      ),
    getByPipelineId: (...args: Parameters<typeof dao.getByPipelineId>) =>
      ResultAsync.fromPromise(dao.getByPipelineId(...args), (error) =>
        toServiceError(error, "Get conversation messages by pipeline"),
      ),
    create: (data: Parameters<typeof dao.create>[0]) =>
      ResultAsync.fromPromise(dao.create(data), (error) =>
        toServiceError(error, "Create conversation message"),
      ),
    update: (id: string, patch: Parameters<typeof dao.update>[1]) =>
      ResultAsync.fromPromise(dao.update(id, patch), (error) =>
        toServiceError(error, "Update conversation message"),
      ).andThen((message) =>
        message ? okAsync(message) : errAsync(new NotFoundError("ConversationMessage", id)),
      ),
    /** N19-02：清除全部对话历史（pipelines 不受影响）。 */
    clearAll: () =>
      ResultAsync.fromPromise(dao.deleteAll(), (error) =>
        toServiceError(error, "Clear conversation history"),
      ),

    delete: (id: string) =>
      ResultAsync.fromPromise(dao.delete(id), (error) =>
        toServiceError(error, "Delete conversation message"),
      ),
  };
};
