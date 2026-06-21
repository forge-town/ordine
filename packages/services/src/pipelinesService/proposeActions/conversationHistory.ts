export type ProposeHistoryMessage = {
  content: string;
  hasProposal: boolean;
  role: "agent" | "user";
};

const MAX_HISTORY_MESSAGES = 20;
const MAX_MESSAGE_CHARS = 500;
const MAX_HISTORY_CHARS = 8000;

const truncateMessage = (content: string): string =>
  content.length <= MAX_MESSAGE_CHARS ? content : `${content.slice(0, MAX_MESSAGE_CHARS)}…`;

/**
 * Window the conversation for prompt injection: keep the most recent
 * messages, truncate each one, and drop the oldest entries until the
 * total stays within budget.
 */
export const windowConversationHistory = (
  messages: ProposeHistoryMessage[],
): ProposeHistoryMessage[] => {
  const recent = messages.slice(-MAX_HISTORY_MESSAGES).map((message) => ({
    ...message,
    content: truncateMessage(message.content),
  }));

  const total = recent.reduce((sum, message) => sum + message.content.length, 0);
  const dropped = recent.reduce(
    (acc, message, index) => {
      if (acc.total > MAX_HISTORY_CHARS && index < recent.length - 1) {
        return { start: index + 1, total: acc.total - message.content.length };
      }

      return acc;
    },
    { start: 0, total },
  );

  return recent.slice(dropped.start);
};

export const buildHistoryBlock = (messages: ProposeHistoryMessage[]): string[] => {
  const windowed = windowConversationHistory(messages);
  if (windowed.length === 0) {
    return [];
  }

  return [
    "=== CONVERSATION HISTORY (oldest first) ===",
    "Earlier conversation between the user and you about this pipeline.",
    'Use it to resolve references like "that node", "the previous proposal", or follow-up revisions.',
    ...windowed.map(
      (message) =>
        `[${message.role === "agent" ? "assistant" : "user"}]${
          message.hasProposal ? " (included a graph proposal)" : ""
        }: ${message.content}`,
    ),
    "",
  ];
};
