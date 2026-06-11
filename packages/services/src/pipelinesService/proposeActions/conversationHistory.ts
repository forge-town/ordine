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

  let total = recent.reduce((sum, message) => sum + message.content.length, 0);
  let start = 0;
  while (total > MAX_HISTORY_CHARS && start < recent.length - 1) {
    total -= recent[start]!.content.length;
    start += 1;
  }

  return recent.slice(start);
};

export const buildHistoryBlock = (messages: ProposeHistoryMessage[]): string[] => {
  const windowed = windowConversationHistory(messages);
  if (windowed.length === 0) {
    return [];
  }

  return [
    "=== CONVERSATION HISTORY (oldest first) ===",
    "Earlier conversation between the user and you about this pipeline.",
    "Use it to resolve references like \"that node\", \"the previous proposal\", or follow-up revisions.",
    ...windowed.map(
      (message) =>
        `[${message.role === "agent" ? "assistant" : "user"}]${
          message.hasProposal ? " (included a graph proposal)" : ""
        }: ${message.content}`,
    ),
    "",
  ];
};
