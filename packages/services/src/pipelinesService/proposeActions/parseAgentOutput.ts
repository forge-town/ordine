const MAX_CLARIFY_OPTIONS = 4;

export type ParsedProposeAgentOutput = {
  clarifyOptions: string[];
  proposalPayload: unknown;
  reply: string | null;
};

/**
 * Normalize the two agent output formats into one shape:
 *
 * - New format: `{ reply, clarifyOptions?, proposal? | actions? }`
 * - Legacy format: `{ summary, actions }` (the whole payload is the proposal)
 *
 * `proposalPayload` is the raw candidate for normalizeProposalPayload +
 * schema validation; it is `null` when the agent intentionally returned
 * no graph change (clarify / explanation-only replies).
 */
export const parseProposeAgentOutput = (value: unknown): ParsedProposeAgentOutput => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { clarifyOptions: [], proposalPayload: value ?? null, reply: null };
  }

  const record = value as Record<string, unknown>;
  const reply =
    typeof record.reply === "string" && record.reply.trim().length > 0
      ? record.reply.trim()
      : null;
  const clarifyOptions = Array.isArray(record.clarifyOptions)
    ? record.clarifyOptions
        .filter(
          (option): option is string => typeof option === "string" && option.trim().length > 0,
        )
        .map((option) => option.trim())
        .slice(0, MAX_CLARIFY_OPTIONS)
    : [];

  if (reply === null) {
    // Legacy format — the whole payload is the proposal.
    return { clarifyOptions, proposalPayload: value, reply: null };
  }

  const proposalPayload =
    record.proposal && typeof record.proposal === "object" && !Array.isArray(record.proposal)
      ? record.proposal
      : Array.isArray(record.actions) && record.actions.length > 0
        ? {
            actions: record.actions,
            summary: typeof record.summary === "string" ? record.summary : reply,
          }
        : null;

  return { clarifyOptions, proposalPayload, reply };
};
