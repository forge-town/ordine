import { ResultAsync } from "neverthrow";
import type { createConversationMessagesDao } from "@repo/models";
import { toServiceError } from "../../../serviceErrors";

export const createClearAllMethod = (dao: ReturnType<typeof createConversationMessagesDao>) => () =>
  ResultAsync.fromPromise(dao.deleteAll(), (error) =>
    toServiceError(error, "Clear conversation history"),
  );
