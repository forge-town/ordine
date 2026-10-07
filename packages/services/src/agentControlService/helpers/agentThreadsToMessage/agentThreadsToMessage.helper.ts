import type { createPipelineAgentMessagesDao } from "@repo/models";
import { PipelineAgentMessageSchema, type PipelineAgentMessage } from "@repo/schemas";

export const toMessage = (
  row: Awaited<
    ReturnType<ReturnType<typeof createPipelineAgentMessagesDao>["findManyBySessionId"]>
  >[number],
): PipelineAgentMessage => PipelineAgentMessageSchema.parse(row);
