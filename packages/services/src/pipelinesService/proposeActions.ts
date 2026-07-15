import { Result, ResultAsync } from "neverthrow";
import {
  type createAgentRuntimesDao,
  type createOperationsDao,
  type createSettingsDao,
} from "@repo/models";
import { extractJsonFromText } from "@repo/agent";
import { logger } from "@repo/logger";
import { validatePipelineActions } from "@repo/pipeline-engine";
import {
  BuiltinNodeTypeSchema,
  PipelineGraphSnapshotSchema,
  PipelineActionProposalSchema,
  type OperationNodeData,
  type PipelineGraphSnapshot,
  type PipelineAction,
  type PipelineActionDiagnostic,
  type PipelineActionProposal,
} from "@repo/schemas";
import { runAgent } from "../pipelineRunnerService/agentRunner/agentRunner";
import { normalizeSettingsRecord } from "../settingsService/normalizeSettingsRecord";
import { MAX_SNAPSHOT_CHARS, truncate } from "./promptText";

// Moved verbatim out of createPipelinesService with zero behavior change; the
// propose-engine expansion (multi-stage flow, conversation history, semantic
// retry) arrives separately with the Propose Engine issue.

const PROPOSE_AGENT_ID = "pipeline-propose-actions";

const PROPOSE_SYSTEM_PROMPT = [
  "You are an AI pipeline editing assistant for Ordine, a pipeline orchestration platform.",
  "Your job is to propose a sequence of graph edit actions that modify a pipeline graph based on the user's request.",
  "",
  "=== AVAILABLE ACTION TYPES ===",
  "",
  "1. addNode — adds a new node to the graph:",
  '   { "type": "addNode", "node": { "id": "<unique>", "type": "<nodeType>", "position": {"x": number, "y": number}, "data": { "nodeType": "<nodeType>", ... } } }',
  "",
  "2. removeNode — removes a node and all its connected edges:",
  '   { "type": "removeNode", "nodeId": "<nodeId>" }',
  "",
  "3. addEdge — adds a connection between two nodes:",
  '   { "type": "addEdge", "edge": { "id": "<unique>", "source": "<nodeId>", "target": "<nodeId>" } }',
  "",
  "4. removeEdge — removes a connection:",
  '   { "type": "removeEdge", "edgeId": "<edgeId>" }',
  "",
  "5. reconnectEdge — changes the source/target of an existing edge:",
  '   { "type": "reconnectEdge", "edgeId": "<edgeId>", "source": "<nodeId>", "target": "<nodeId>" }',
  "",
  "6. replaceNodeData — replaces the data payload of a node (must keep the same nodeType):",
  '   { "type": "replaceNodeData", "nodeId": "<nodeId>", "data": { "nodeType": "<sameNodeType>", ... } }',
  "",
  "=== OUTPUT SCHEMA ===",
  "Return ONLY a JSON object matching this exact schema:",
  '{ "summary": "Brief description of what changes are proposed and why", "actions": [ /* array of actions above */ ] }',
  "",
  "=== RULES ===",
  "- The 'summary' field must be a non-empty string explaining the proposed changes.",
  "- The 'actions' array must contain at least one action.",
  "- All node IDs and edge IDs must be unique within the graph.",
  "- When adding a node, the node 'type' MUST match the 'nodeType' inside its data payload.",
  "- When adding edges, both source and target nodes must already exist in the graph (or be added in a previous operation).",
  "- When replacing node data, the 'nodeType' inside 'data' MUST match the node's existing type.",
  "- When adding or replacing operation nodes, use ONLY operationId values from the provided available operations list.",
  "- For operation nodes, operationName MUST match the selected available operation's name.",
  "- Compound nodes (type === 'compound' or data.nodeType === 'compound') are NOT supported.",
  "- Child nodes (nodes with a 'parentId' field) are NOT supported.",
  "- Do NOT propose actions that create compound nodes or child nodes.",
  "- Return ONLY the JSON object. No markdown, no explanation, no code fences.",
].join("\n");

const makeProposalDiagnostic = (
  code: PipelineActionDiagnostic["code"],
  message: string,
  actionIndex: number,
): PipelineActionDiagnostic => ({
  code,
  message,
  actionIndex,
  severity: "error",
});

const validateOperationNodeCatalog = (
  nodeId: string,
  data: OperationNodeData,
  operationById: Map<string, { name: string }>,
  actionIndex: number,
): PipelineActionDiagnostic[] => {
  const catalogOperation = operationById.get(data.operationId);
  if (!catalogOperation) {
    return [
      makeProposalDiagnostic(
        "INVALID_NODE_DATA",
        `Operation node "${nodeId}" references unknown operationId "${data.operationId}".`,
        actionIndex,
      ),
    ];
  }

  if (catalogOperation.name !== data.operationName) {
    return [
      makeProposalDiagnostic(
        "INVALID_NODE_DATA",
        `Operation node "${nodeId}" operationName must match operation "${data.operationId}" (${catalogOperation.name}).`,
        actionIndex,
      ),
    ];
  }

  return [];
};

const validateProposalActionCatalog = (
  actions: PipelineAction[],
  operationById: Map<string, { name: string }>,
): PipelineActionDiagnostic[] =>
  actions.flatMap((action, actionIndex) => {
    if (action.type === "addNode" && action.node.data.nodeType === "operation") {
      return validateOperationNodeCatalog(
        action.node.id,
        action.node.data,
        operationById,
        actionIndex,
      );
    }

    if (action.type === "replaceNodeData" && action.data.nodeType === "operation") {
      return validateOperationNodeCatalog(action.nodeId, action.data, operationById, actionIndex);
    }

    return [];
  });

const normalizeProposalActionCatalogNames = (
  actions: PipelineAction[],
  operationById: Map<string, { name: string }>,
): PipelineAction[] =>
  actions.map((action) => {
    if (action.type === "addNode" && action.node.data.nodeType === "operation") {
      const catalogOperation = operationById.get(action.node.data.operationId);
      if (!catalogOperation) {
        return action;
      }

      return {
        ...action,
        node: {
          ...action.node,
          data: {
            ...action.node.data,
            operationName: catalogOperation.name,
          },
        },
      };
    }

    if (action.type === "replaceNodeData" && action.data.nodeType === "operation") {
      const catalogOperation = operationById.get(action.data.operationId);
      if (!catalogOperation) {
        return action;
      }

      return {
        ...action,
        data: {
          ...action.data,
          operationName: catalogOperation.name,
        },
      };
    }

    return action;
  });

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

const normalizeProposalPayload = (value: unknown): unknown => {
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

export interface ProposeActionsOptions {
  snapshot: PipelineGraphSnapshot;
  message: string;
  pipelineId?: string;
  pipelineName?: string;
  runtimeId?: string;
}

export interface ProposeActionsDeps {
  agentRuntimesDao: ReturnType<typeof createAgentRuntimesDao>;
  operationsDao: ReturnType<typeof createOperationsDao>;
  settingsDao: ReturnType<typeof createSettingsDao>;
}

export const proposeActions = async (
  deps: ProposeActionsDeps,
  opts: ProposeActionsOptions,
): Promise<{
  proposal: PipelineActionProposal | null;
  diagnostics: PipelineActionDiagnostic[];
  reply?: string;
}> => {
  const { agentRuntimesDao, operationsDao, settingsDao } = deps;
  const parsedSnapshot = PipelineGraphSnapshotSchema.safeParse(opts.snapshot);
  if (!parsedSnapshot.success) {
    logger.warn({ error: parsedSnapshot.error }, "proposeActions: invalid pipeline graph snapshot");

    return { proposal: null, diagnostics: [] };
  }

  const snapshot = parsedSnapshot.data;
  const settings = normalizeSettingsRecord(await settingsDao.get());
  const configuredRuntimes = await agentRuntimesDao.findMany();
  const selectedRuntime = opts.runtimeId
    ? (configuredRuntimes.find((runtime) => runtime.id === opts.runtimeId) ?? null)
    : null;

  if (opts.runtimeId && !selectedRuntime) {
    logger.warn({ runtimeId: opts.runtimeId }, "proposeActions: runtime not found");

    return {
      proposal: null,
      diagnostics: [],
      reply: `Selected runtime "${opts.runtimeId}" is not available.`,
    };
  }

  const defaultRuntime =
    configuredRuntimes.find((runtime) => runtime.type === settings.defaultAgentRuntime) ?? null;
  const effectiveRuntime = selectedRuntime ?? defaultRuntime;
  const operations = await operationsDao.findMany();
  const operationCatalog = operations.map((operation) => ({
    id: operation.id,
    name: operation.name,
    description: operation.description,
    acceptedObjectTypes: operation.acceptedObjectTypes,
  }));
  const operationById = new Map(
    operationCatalog.map((operation) => [operation.id, { name: operation.name }]),
  );

  const userPromptText = [
    "=== PIPELINE CONTEXT ===",
    `Pipeline ID: ${opts.pipelineId ?? "(unsaved)"}`,
    `Pipeline Name: ${opts.pipelineName ?? "(unnamed)"}`,
    "",
    "=== CURRENT GRAPH ===",
    truncate(JSON.stringify(snapshot, null, 2), MAX_SNAPSHOT_CHARS),
    "",
    `=== AVAILABLE OPERATIONS (${operationCatalog.length}) ===`,
    truncate(JSON.stringify(operationCatalog, null, 2), MAX_SNAPSHOT_CHARS),
    "",
    "=== USER REQUEST ===",
    opts.message,
    "",
    "Propose the operations now. Return ONLY the JSON object.",
  ].join("\n");

  const MAX_RETRIES = 3;
  const execution = await (async () => {
    for (const attempt of Array.from({ length: MAX_RETRIES }, (_, i) => i + 1)) {
      const result = await ResultAsync.fromPromise(
        runAgent({
          agent: effectiveRuntime?.type ?? settings.defaultAgentRuntime,
          systemPrompt: PROPOSE_SYSTEM_PROMPT,
          userPrompt: userPromptText,
          inputPath: process.cwd(),
          agentId: PROPOSE_AGENT_ID,
          allowedTools: [],
          logPrefix: "proposeActions",
          apiKey: settings.defaultApiKey,
          model: settings.defaultModel,
          ssh:
            effectiveRuntime?.connection.mode === "ssh" ? effectiveRuntime.connection : undefined,
        }),
        (cause) => (cause instanceof Error ? cause : new Error(String(cause))),
      );
      if (result.isOk()) return result;
      if (attempt === MAX_RETRIES) return result;
      logger.warn(
        { attempt, err: result.error.message },
        "proposeActions: agent attempt failed, retrying",
      );
    }

    return undefined;
  })();

  if (!execution || execution.isErr()) {
    logger.error({ err: execution?.error }, "proposeActions: agent failed after retries");

    return { proposal: null, diagnostics: [] };
  }

  const raw = execution.value;
  const extractJsonResult = Result.fromThrowable(
    extractJsonFromText,
    () => new Error("failed to extract JSON from agent response"),
  )(raw);
  if (extractJsonResult.isErr()) {
    logger.error({ raw }, "proposeActions: failed to extract JSON from agent response");

    return { proposal: null, diagnostics: [] };
  }

  const parseJsonResult = Result.fromThrowable(
    JSON.parse,
    () => new Error("extracted text is not valid JSON"),
  )(extractJsonResult.value);
  if (parseJsonResult.isErr()) {
    logger.error(
      { json: extractJsonResult.value },
      "proposeActions: extracted text is not valid JSON",
    );

    return { proposal: null, diagnostics: [] };
  }

  const normalizedProposal = normalizeProposalPayload(parseJsonResult.value);
  const parsed = PipelineActionProposalSchema.safeParse(normalizedProposal);
  if (!parsed.success) {
    logger.error(
      { error: parsed.error },
      "proposeActions: invalid PipelineActionProposal from agent",
    );

    return { proposal: null, diagnostics: [] };
  }

  const proposal = {
    ...parsed.data,
    actions: normalizeProposalActionCatalogNames(parsed.data.actions, operationById),
  };
  const validationResult = validatePipelineActions(snapshot, proposal.actions);
  const graphDiagnostics = validationResult.isErr() ? validationResult.error : [];
  const operationDiagnostics = validateProposalActionCatalog(proposal.actions, operationById);

  return {
    proposal,
    diagnostics: [...graphDiagnostics, ...operationDiagnostics],
  };
};
