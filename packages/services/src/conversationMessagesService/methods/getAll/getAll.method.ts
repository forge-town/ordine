import { ResultAsync } from "neverthrow";
import type { createConversationMessagesDao } from "@repo/models";
import { toServiceError } from "../../../serviceErrors";

export const createGetAllMethod = (dao: ReturnType<typeof createConversationMessagesDao>) => () =>
  ResultAsync.fromPromise(dao.findMany(), (error) =>
    toServiceError(error, "Get conversation messages"),
  );
