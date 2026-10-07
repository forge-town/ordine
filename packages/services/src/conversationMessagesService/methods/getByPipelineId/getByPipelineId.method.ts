import { ResultAsync } from "neverthrow";
import type { createConversationMessagesDao } from "@repo/models";
import { toServiceError } from "../../../serviceErrors";

export const createGetByPipelineIdMethod =
  (dao: ReturnType<typeof createConversationMessagesDao>) =>
  (...args: Parameters<typeof dao.findManyByPipelineId>) =>
    ResultAsync.fromPromise(dao.findManyByPipelineId(...args), (error) =>
      toServiceError(error, "Get conversation messages by pipeline"),
    );
