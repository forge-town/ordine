import { ResultAsync } from "neverthrow";
import type { createConversationMessagesDao } from "@repo/models";
import { toServiceError } from "../../../serviceErrors";

export const createCreateMethod =
  (dao: ReturnType<typeof createConversationMessagesDao>) =>
  (data: Parameters<typeof dao.create>[0]) =>
    ResultAsync.fromPromise(dao.create(data), (error) =>
      toServiceError(error, "Create conversation message"),
    );
