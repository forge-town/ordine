import { ResultAsync } from "neverthrow";
import type { createConversationMessagesDao } from "@repo/models";
import { toServiceError } from "../../../serviceErrors";

export const createDeleteMethod =
  (dao: ReturnType<typeof createConversationMessagesDao>) => (id: string) =>
    ResultAsync.fromPromise(dao.delete(id), (error) =>
      toServiceError(error, "Delete conversation message"),
    );
