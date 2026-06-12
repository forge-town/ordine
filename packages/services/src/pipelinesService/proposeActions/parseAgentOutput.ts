const MAX_CLARIFY_OPTIONS = 4;

export type ParsedNewOperation = {
  description: string;
  id: string;
  name: string;
  prompt: string;
};

export type ParsedProposeAgentOutput = {
  clarifyOptions: string[];
  newOperations: ParsedNewOperation[];
  /** N19-01：空画布建图时 Agent 给出的流水线名（仅作建议，前端按规则采用）。 */
  pipelineName: string | null;
  proposalPayload: unknown;
  reply: string | null;
};

const parseNewOperations = (value: unknown): ParsedNewOperation[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return [];
    }
    const record = entry as Record<string, unknown>;
    if (typeof record.id !== "string" || record.id.trim().length === 0) {
      return [];
    }
    if (typeof record.name !== "string" || record.name.trim().length === 0) {
      return [];
    }

    return [
      {
        description: typeof record.description === "string" ? record.description : "",
        id: record.id.trim(),
        name: record.name.trim(),
        prompt: typeof record.prompt === "string" ? record.prompt : "",
      },
    ];
  });
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
    return {
      clarifyOptions: [],
      newOperations: [],
      pipelineName: null,
      proposalPayload: value ?? null,
      reply: null,
    };
  }

  const record = value as Record<string, unknown>;
  const reply =
    typeof record.reply === "string" && record.reply.trim().length > 0 ? record.reply.trim() : null;
  const clarifyOptions = Array.isArray(record.clarifyOptions)
    ? record.clarifyOptions
        .filter(
          (option): option is string => typeof option === "string" && option.trim().length > 0,
        )
        .map((option) => option.trim())
        .slice(0, MAX_CLARIFY_OPTIONS)
    : [];

  const newOperations = parseNewOperations(record.newOperations);
  const pipelineName =
    typeof record.pipelineName === "string" && record.pipelineName.trim().length > 0
      ? record.pipelineName.trim().slice(0, 60)
      : null;

  if (reply === null) {
    // Legacy format — the whole payload is the proposal.
    return { clarifyOptions, newOperations, pipelineName, proposalPayload: value, reply: null };
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

  return { clarifyOptions, newOperations, pipelineName, proposalPayload, reply };
};
