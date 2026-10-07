import { ResultAsync, errAsync, okAsync } from "neverthrow";
import type { createConversationMessagesDao } from "@repo/models";
import { NotFoundError, toServiceError } from "../../../serviceErrors";

export const createUpdateMethod =
  (dao: ReturnType<typeof createConversationMessagesDao>) =>
  (id: string, patch: Parameters<typeof dao.update>[1]) =>
    ResultAsync.fromPromise(dao.update(id, patch), (error) =>
      toServiceError(error, "Update conversation message"),
    ).andThen((message) =>
      message ? okAsync(message) : errAsync(new NotFoundError("ConversationMessage", id)),
    );
