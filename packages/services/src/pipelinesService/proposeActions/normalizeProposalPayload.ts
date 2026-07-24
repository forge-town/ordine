import { BuiltinNodeTypeSchema, type BuiltinNodeType } from "@repo/schemas";

/*
 * LLMs return the proposal in several near-miss shapes (snake_case action
 * types, flat node payloads, missing data envelopes, missing nodeType).
 * This module reshapes them into the canonical PipelineActionProposal form
 * before schema validation. Each step is a small pure function:
 *
 *   unwrapProposalEnvelope → normalizeActionType → hoistNodeData → applyInferredNodeType
 */

const NODE_TYPE_ALIASES = {
  promptInput: "prompt",
  prompt_input: "prompt",
  github_project: "github-project",
  output_local_path: "output-local-path",
  output_project_path: "output-project-path",
} as const;

const ACTION_TYPE_ALIASES = {
  add_node: "addNode",
  remove_node: "removeNode",
  add_edge: "addEdge",
  remove_edge: "removeEdge",
  reconnect_edge: "reconnectEdge",
  replace_node_data: "replaceNodeData",
} as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

/** Unwrap an optional `{ proposal: ... }` envelope around the payload. */
const unwrapProposalEnvelope = (value: object): unknown =>
  "proposal" in value && value.proposal ? value.proposal : value;

/** Map snake_case action types (under `type` or `op`) to their camelCase form. */
const normalizeActionType = (rawActionRecord: Record<string, unknown>): unknown =>
  typeof rawActionRecord.type === "string"
    ? rawActionRecord.type in ACTION_TYPE_ALIASES
      ? ACTION_TYPE_ALIASES[rawActionRecord.type as keyof typeof ACTION_TYPE_ALIASES]
      : rawActionRecord.type
    : typeof rawActionRecord.op === "string" && rawActionRecord.op in ACTION_TYPE_ALIASES
      ? ACTION_TYPE_ALIASES[rawActionRecord.op as keyof typeof ACTION_TYPE_ALIASES]
      : rawActionRecord.type;

/**
 * Reshape addNode payloads that miss the node/data envelope:
 * - a node without `data` gets its known flat fields hoisted into `data`;
 * - an action without `node` but with a `data` record gets a node
 *   synthesized around that record.
 */
const hoistNodeData = (action: Record<string, unknown>): void => {
  if (
    action.type === "addNode" &&
    isRecord(action.node) &&
    !("data" in (action.node as Record<string, unknown>))
  ) {
    const nodeRecord = action.node as Record<string, unknown>;
    action.node = {
      ...nodeRecord,
      data: {
        ...(typeof nodeRecord.label === "string" ? { label: nodeRecord.label } : {}),
        ...(typeof nodeRecord.prompt === "string" ? { prompt: nodeRecord.prompt } : {}),
        ...(typeof nodeRecord.folderPath === "string" ? { folderPath: nodeRecord.folderPath } : {}),
        ...(typeof nodeRecord.localPath === "string" ? { localPath: nodeRecord.localPath } : {}),
        ...(typeof nodeRecord.projectPath === "string"
          ? { projectPath: nodeRecord.projectPath }
          : {}),
        ...(typeof nodeRecord.operationId === "string"
          ? { operationId: nodeRecord.operationId }
          : {}),
        ...(typeof nodeRecord.operationName === "string"
          ? { operationName: nodeRecord.operationName }
          : {}),
        ...(typeof nodeRecord.owner === "string" ? { owner: nodeRecord.owner } : {}),
        ...(typeof nodeRecord.repo === "string" ? { repo: nodeRecord.repo } : {}),
        ...(typeof nodeRecord.filePath === "string" ? { filePath: nodeRecord.filePath } : {}),
      },
    };
  }

  if (action.type === "addNode" && !("node" in action) && isRecord(action.data)) {
    const dataRecord = action.data;
    action.node = {
      id: dataRecord.id,
      type: dataRecord.type,
      position: isRecord(dataRecord.position) ? dataRecord.position : { x: 0, y: 0 },
      data: dataRecord,
    };
  }
};

/**
 * Infer the builtin node type: data.nodeType wins, then the (alias-resolved)
 * node.type, then a data-field heuristic. Returns null when nothing matches.
 */
const inferNodeType = (
  node: Record<string, unknown>,
  data: Record<string, unknown>,
): BuiltinNodeType | null => {
  const parsedNodeType =
    typeof node.type === "string"
      ? BuiltinNodeTypeSchema.safeParse(
          node.type in NODE_TYPE_ALIASES
            ? NODE_TYPE_ALIASES[node.type as keyof typeof NODE_TYPE_ALIASES]
            : node.type,
        )
      : null;
  const parsedDataNodeType =
    typeof data.nodeType === "string" ? BuiltinNodeTypeSchema.safeParse(data.nodeType) : null;

  return parsedDataNodeType?.success
    ? parsedDataNodeType.data
    : parsedNodeType?.success
      ? parsedNodeType.data
      : typeof data.prompt === "string"
        ? "prompt"
        : typeof data.folderPath === "string"
          ? "folder"
          : typeof data.localPath === "string"
            ? "output-local-path"
            : typeof data.projectPath === "string"
              ? "output-project-path"
              : typeof data.operationId === "string"
                ? "operation"
                : typeof data.owner === "string" || typeof data.repo === "string"
                  ? "github-project"
                  : typeof data.filePath === "string"
                    ? "file"
                    : null;
};

/**
 * Stamp the inferred node type onto both node.type and data.nodeType so they
 * agree, defaulting prompt nodes to an empty prompt string.
 */
const applyInferredNodeType = (actionRecord: Record<string, unknown>): unknown => {
  if (actionRecord.type !== "addNode") {
    return actionRecord;
  }

  const node = isRecord(actionRecord.node) ? actionRecord.node : null;
  const data = node && isRecord(node.data) ? node.data : null;

  if (!node || !data) {
    return actionRecord;
  }

  const inferredNodeType = inferNodeType(node, data);
  if (!inferredNodeType) {
    return actionRecord;
  }

  return {
    ...actionRecord,
    node: {
      ...node,
      type: inferredNodeType,
      data: {
        ...data,
        nodeType: inferredNodeType,
        ...(inferredNodeType === "prompt" && typeof data.prompt !== "string" ? { prompt: "" } : {}),
      },
    },
  };
};

const normalizeAction = (rawAction: unknown): unknown => {
  if (!isRecord(rawAction)) {
    return rawAction;
  }

  const normalizedType = normalizeActionType(rawAction);
  const normalizedAction: Record<string, unknown> = {
    ...rawAction,
    ...(typeof normalizedType === "string" ? { type: normalizedType } : {}),
  };

  hoistNodeData(normalizedAction);

  return applyInferredNodeType(normalizedAction);
};

export const normalizeProposalPayload = (value: unknown): unknown => {
  if (!isRecord(value)) {
    return value;
  }

  const rawProposal = unwrapProposalEnvelope(value);
  if (!isRecord(rawProposal)) {
    return rawProposal;
  }

  const rawActions = Array.isArray(rawProposal.actions)
    ? rawProposal.actions
    : Array.isArray(rawProposal.operations)
      ? rawProposal.operations
      : [];

  return {
    ...rawProposal,
    summary:
      typeof rawProposal.summary === "string" && rawProposal.summary.trim().length > 0
        ? rawProposal.summary
        : "Apply AI-assisted graph updates.",
    actions: rawActions.map(normalizeAction),
  };
};
