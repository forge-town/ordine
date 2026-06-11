import { BuiltinNodeTypeSchema } from "@repo/schemas";

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

export const normalizeProposalPayload = (value: unknown): unknown => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }

  const rawProposal = "proposal" in value && value.proposal ? value.proposal : value;
  if (!rawProposal || typeof rawProposal !== "object" || Array.isArray(rawProposal)) {
    return rawProposal;
  }

  const proposalRecord = rawProposal as Record<string, unknown>;
  const rawActions = Array.isArray(proposalRecord.actions)
    ? proposalRecord.actions
    : Array.isArray(proposalRecord.operations)
      ? proposalRecord.operations
      : [];
  const actions = rawActions.map((rawAction) => {
    if (!rawAction || typeof rawAction !== "object" || Array.isArray(rawAction)) {
      return rawAction;
    }

    const rawActionRecord = rawAction as Record<string, unknown>;
    const normalizedType =
      typeof rawActionRecord.type === "string"
        ? rawActionRecord.type in ACTION_TYPE_ALIASES
          ? ACTION_TYPE_ALIASES[rawActionRecord.type as keyof typeof ACTION_TYPE_ALIASES]
          : rawActionRecord.type
        : typeof rawActionRecord.op === "string" && rawActionRecord.op in ACTION_TYPE_ALIASES
          ? ACTION_TYPE_ALIASES[rawActionRecord.op as keyof typeof ACTION_TYPE_ALIASES]
          : rawActionRecord.type;
    const normalizedAction: Record<string, unknown> = {
      ...rawActionRecord,
      ...(typeof normalizedType === "string" ? { type: normalizedType } : {}),
    };

    if (
      normalizedAction.type === "addNode" &&
      normalizedAction.node &&
      typeof normalizedAction.node === "object" &&
      !Array.isArray(normalizedAction.node) &&
      !("data" in (normalizedAction.node as Record<string, unknown>))
    ) {
      const nodeRecord = normalizedAction.node as Record<string, unknown>;
      normalizedAction.node = {
        ...nodeRecord,
        data: {
          ...(typeof nodeRecord.label === "string" ? { label: nodeRecord.label } : {}),
          ...(typeof nodeRecord.prompt === "string" ? { prompt: nodeRecord.prompt } : {}),
          ...(typeof nodeRecord.folderPath === "string"
            ? { folderPath: nodeRecord.folderPath }
            : {}),
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

    if (
      normalizedAction.type === "addNode" &&
      !("node" in normalizedAction) &&
      normalizedAction.data &&
      typeof normalizedAction.data === "object" &&
      !Array.isArray(normalizedAction.data)
    ) {
      const dataRecord = normalizedAction.data as Record<string, unknown>;
      normalizedAction.node = {
        id: dataRecord.id,
        type: dataRecord.type,
        position:
          dataRecord.position &&
          typeof dataRecord.position === "object" &&
          !Array.isArray(dataRecord.position)
            ? dataRecord.position
            : { x: 0, y: 0 },
        data: dataRecord,
      };
    }

    const action = normalizedAction;

    if (!action || typeof action !== "object" || Array.isArray(action)) {
      return action;
    }

    const actionRecord = action as Record<string, unknown>;
    if (actionRecord.type !== "addNode") {
      return action;
    }

    const node =
      actionRecord.node &&
      typeof actionRecord.node === "object" &&
      !Array.isArray(actionRecord.node)
        ? (actionRecord.node as Record<string, unknown>)
        : null;
    const data =
      node?.data && typeof node.data === "object" && !Array.isArray(node.data)
        ? (node.data as Record<string, unknown>)
        : null;

    if (!node || !data) {
      return action;
    }

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
    const inferredNodeType = parsedDataNodeType?.success
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

    if (!inferredNodeType) {
      return action;
    }

    return {
      ...actionRecord,
      node: {
        ...node,
        type: inferredNodeType,
        data: {
          ...data,
          nodeType: inferredNodeType,
          ...(inferredNodeType === "prompt" && typeof data.prompt !== "string"
            ? { prompt: "" }
            : {}),
        },
      },
    };
  });

  return {
    ...proposalRecord,
    summary:
      typeof proposalRecord.summary === "string" && proposalRecord.summary.trim().length > 0
        ? proposalRecord.summary
        : "Apply AI-assisted graph updates.",
    actions,
  };
};
