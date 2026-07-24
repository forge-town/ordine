import type { createConversationMessagesDao } from "@repo/models";
import type { ProposeHistoryMessage } from "./conversationHistory";

export type LoadConversationHistoryDeps = {
  conversationMessagesDao: ReturnType<typeof createConversationMessagesDao>;
};

/**
 * Load the pipeline conversation as prompt history. The current user message
 * is persisted before proposeActions is called, so a trailing duplicate of it
 * is dropped to avoid repeating the USER REQUEST section.
 */
export const loadConversationHistory = async (
  deps: LoadConversationHistoryDeps,
  pipelineId: string | undefined,
  currentMessage: string,
): Promise<ProposeHistoryMessage[]> => {
  if (!pipelineId) {
    return [];
  }

  const rows = await deps.conversationMessagesDao.findManyByPipelineId(pipelineId);
  const trailing = rows.at(-1);
  const withoutCurrent =
    trailing && trailing.role === "user" && trailing.content.trim() === currentMessage.trim()
      ? rows.slice(0, -1)
      : rows;

  return withoutCurrent.map((row) => ({
    content: row.content,
    hasProposal: Boolean((row.metadata as { proposalSnapshot?: unknown } | null)?.proposalSnapshot),
    role: row.role === "user" ? "user" : "agent",
  }));
};
