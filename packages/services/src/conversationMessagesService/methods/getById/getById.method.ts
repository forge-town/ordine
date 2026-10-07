import { ResultAsync, errAsync, okAsync } from "neverthrow";
import type { createConversationMessagesDao } from "@repo/models";
import { NotFoundError, toServiceError } from "../../../serviceErrors";

export const createGetByIdMethod =
  (dao: ReturnType<typeof createConversationMessagesDao>) => (id: string) =>
    ResultAsync.fromPromise(dao.findById(id), (error) =>
      toServiceError(error, "Get conversation message"),
    ).andThen((message) =>
      message ? okAsync(message) : errAsync(new NotFoundError("ConversationMessage", id)),
    );
