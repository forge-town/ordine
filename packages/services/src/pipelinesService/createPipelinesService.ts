import "../text-imports.d.ts";

import { Result, ResultAsync } from "neverthrow";
import { homedir } from "node:os";
import { join } from "node:path";
import nodeTypesRef from "../../../../skills/ordine-create-pipeline/references/node-types.md" with { type: "text" };
import pipelineAnatomyRef from "../../../../skills/ordine-create-pipeline/references/pipeline-anatomy.md" with { type: "text" };
import {
  createAgentRuntimesDao,
  createDistillationsDao,
  createJobsDao,
  createJobTracesDao,
  createOperationsDao,
  createPipelineRunsDao,
  createPipelinesDao,
  createSettingsDao,
  type DbConnection,
} from "@repo/models";
import { extractJsonFromText } from "@repo/agent";
import { logger } from "@repo/logger";
import { validatePipelineActions } from "@repo/pipeline-engine";
import {
  BuiltinNodeTypeSchema,
  PipelineGraphSnapshotSchema,
  PipelineActionProposalSchema,
  PipelineSchema,
  type ObjectNodeType,
  type OperationNodeData,
  type PipelineData,
  type PipelineGraphSnapshot,
  type PipelineAction,
  type PipelineActionDiagnostic,
  type PipelineActionProposal,
} from "@repo/schemas";
import { runAgent } from "../pipelineRunnerService/agentRunner/agentRunner";
import { normalizeSettingsRecord } from "../settingsService/normalizeSettingsRecord";

const expandTilde = (p: string): string =>
  p.startsWith("~/") ? join(homedir(), p.slice(2)) : p === "~" ? homedir() : p;

const expandTildeInNodes = (nodes: PipelineData["nodes"]): PipelineData["nodes"] =>
  nodes.map((node) => {
    const { data } = node;
    if (data.nodeType === "folder" && data.folderPath) {
      return { ...node, data: { ...data, folderPath: expandTilde(data.folderPath) } };
    }
    if (data.nodeType === "output-local-path" && data.localPath) {
      return { ...node, data: { ...data, localPath: expandTilde(data.localPath) } };
    }

    return node;
  });

const GENERATE_AGENT_ID = "pipeline-generator";

const OPTIMIZE_AGENT_ID = "pipeline-optimizer";
const PROPOSE_AGENT_ID = "pipeline-propose-actions";

const SKILL_REFERENCES = [nodeTypesRef, pipelineAnatomyRef].filter(Boolean).join("\n\n---\n\n");

const buildGenerateSystemPrompt = (skillReferences: string): string =>
  [
    "You are a pipeline structure generation agent for Ordine, an AI-first pipeline orchestration platform.",
    "Your job is to generate an initial pipeline graph (nodes and edges) from a user's description.",
    "",
    "=== OUTPUT SCHEMA ===",
    '{ "nodes": [PipelineNode], "edges": [PipelineEdge] }',
    "",
    ...(skillReferences
      ? [
          "=== REFERENCE DOCUMENTATION ===",
          "The following is the canonical documentation for node types and pipeline anatomy.",
          "Use this as your primary reference for constructing nodes and edges.",
          "",
          skillReferences,
          "",
        ]
      : [
          "=== NODE TYPES ===",
          "",
          "1. INPUT — github-projects:",
          '{ "id": "<unique>", "type": "github-projects", "position": {"x":0,"y":0},',
          '  "data": { "nodeType": "github-projects", "label": "...", "owner": "<github-owner>",',
          '    "repo": "<repo-name>", "branch": "main", "sourceType": "github",',
          '    "accessMode": "remote", "disclosureMode": "tree" } }',
          "",
          "2. INPUT — folder:",
          '{ "id": "<unique>", "type": "folder", "position": {"x":0,"y":0},',
          '  "data": { "nodeType": "folder", "label": "...", "folderPath": "/path/to/folder" } }',
          "",
          "3. INPUT — prompt (text/instruction input, NOT tied to any file or folder):",
          '{ "id": "<unique>", "type": "prompt", "position": {"x":0,"y":0},',
          '  "data": { "nodeType": "prompt", "label": "...", "prompt": "<the prompt text>" } }',
          "",
          "4. OPERATION — processing step:",
          '{ "id": "<unique>", "type": "operation", "position": {"x":<step*400>,"y":0},',
          '  "data": { "nodeType": "operation", "label": "...", "operationId": "<from list>",',
          '    "operationName": "<from list>", "status": "idle" } }',
          "",
          "5. OUTPUT — output-local-path:",
          '{ "id": "<unique>", "type": "output-local-path", "position": {"x":<last>,"y":0},',
          '  "data": { "nodeType": "output-local-path", "label": "Output",',
          '    "localPath": "/tmp/ordine-output" } }',
          "",
        ]),
    'Each edge: { "id": "<unique>", "source": "<nodeId>", "target": "<nodeId>" }',
    "",
    "=== STRUCTURAL RULES ===",
    "- Pipeline MUST have at least 1 input node (github-projects, folder, or prompt)",
    "- Pipeline MUST have at least 1 output node (output-local-path)",
    "- Pipeline MUST have a complete path: input → operation(s) → output",
    "- Use ONLY operations from the provided operations list (match by id and name)",
    "- Arrange nodes LEFT TO RIGHT with ~400px horizontal spacing (same y=0)",
    "- Infer the most appropriate input type from the user's description",
    "- If the task is about processing/transforming TEXT, instructions, or data NOT tied to a local file/folder, use a PROMPT input node instead of folder/code-file.",
    "- If the task is about processing a local folder or codebase, use a FOLDER input node.",
    "- If the task is about a GitHub repository, use a GITHUB-PROJECTS input node.",
    "",
    "=== OPERATION SELECTION RULES (CRITICAL) ===",
    "- Read the user's PIPELINE GOAL carefully. Every operation you pick MUST directly serve that goal.",
    "- ONLY use operations whose name and description SEMANTICALLY MATCH the user's stated task.",
    "- Check each operation's acceptedObjectTypes — it must accept the type flowing from the previous node.",
    "- Build the MINIMUM VIABLE pipeline — use the fewest operations needed to achieve the goal.",
    "- Do NOT add extra operations just to fill space or make the pipeline look complex.",
    "- If no matching operation exists for a described step, SKIP it entirely.",
    "",
    "=== ANTI-PATTERNS (NEVER DO THESE) ===",
    "- Do NOT default to audit/check/lint/best-practice operations unless the user EXPLICITLY asks for code quality checking.",
    "- Do NOT pick operations just because they appear first in the list. Evaluate ALL operations before choosing.",
    "- Do NOT include more than 3-4 operations unless the user's description genuinely requires more steps.",
    "- Do NOT invent or hallucinate operation IDs/names — only use EXACT matches from the provided list.",
    "- If the user's description is vague, prefer a simple 1-2 operation pipeline over a complex one.",
    "- Do NOT use generic/catch-all operations (like 内联执行计划/execute-plan-inline) as a substitute when no operation semantically matches the task.",
    "- If a NEWLY CREATED OPERATIONS section is provided, you MUST use ALL of those operations.",
    "",
    "=== PATH RULES (CRITICAL) ===",
    "- All file/folder paths MUST be absolute (starting with /). NEVER use ~ or ~/.",
    `- The current user's home directory is: ${homedir()}`,
    `- 'Desktop' means: ${join(homedir(), "Desktop")}`,
    `- 'Documents' means: ${join(homedir(), "Documents")}`,
    "- If you cannot determine the absolute path, use /tmp/ordine-output as fallback.",
    "",
    "Return ONLY the JSON object with nodes and edges. No markdown, no explanation, no code fences.",
  ].join("\n");

const ANALYZE_AGENT_ID = "intent-analyzer";

const ANALYZE_SYSTEM_PROMPT = [
  "You are an intent analysis agent for Ordine, an AI-first pipeline orchestration platform.",
  "Your job is to analyze a user's pipeline description and match their intent against available operations.",
  "",
  "=== OUTPUT SCHEMA ===",
  "{",
  '  "matchedOperations": [{ "operationId": "<id>", "operationName": "<name>", "reason": "<why this matches>" }],',
  '  "unmatchedSteps": [{ "step": "<description of what the user wants>", "reason": "<why no operation matches>" }]',
  "}",
  "",
  "=== ANALYSIS RULES ===",
  "- Break down the user's description into discrete processing steps.",
  "- For EACH step, check the AVAILABLE OPERATIONS list for a semantic match.",
  "- A match means the operation's name AND description align with the user's intended step.",
  "- If a step matches an operation, add it to matchedOperations with the EXACT operationId and operationName.",
  "- If no operation matches a step, add it to unmatchedSteps.",
  "- Be STRICT about matching — only match when the operation clearly serves the described step.",
  "- Do NOT match operations just because they exist. Only match when there is genuine semantic alignment.",
  "- Order matchedOperations in the logical execution sequence the user described.",
  "",
  "Return ONLY the JSON object. No markdown, no explanation, no code fences.",
].join("\n");

const buildOptimizeSystemPrompt = (skillReferences: string): string =>
  [
    "You are a pipeline optimization agent for Ordine, an AI-first pipeline orchestration platform.",
    "Your job is to generate an IMPROVED pipeline based on a distillation report from a previous run.",
    "",
    "=== YOUR PRIMARY DIRECTIVE ===",
    "The distillation report contains structured analysis of what went wrong and how to fix it.",
    "You MUST treat these fields as MANDATORY REQUIREMENTS, not suggestions:",
    "",
    "1. **nextActions**: These are specific, actionable fixes. Implement ALL of them in the new pipeline.",
    "   - If it says 'add output node' → the new pipeline must have an output node",
    "   - If it says 'replace LLM with API call' → restructure the pipeline to use fewer/no agent nodes",
    "   - If it says 'split into multiple steps' → add more operation nodes in the chain",
    "",
    "2. **minimalPath**: This is the IDEAL execution path. Design the new pipeline to follow this flow.",
    "   Map each step in minimalPath to a concrete node in the pipeline.",
    "",
    "3. **insights**: These explain WHY the original pipeline was suboptimal.",
    "   Use insights to inform your design decisions (e.g., reduce token usage, fix error patterns).",
    "",
    "4. **reusableAssets**: These are ready-made building blocks.",
    "   If a reusable asset provides a pipeline template, use it as your starting blueprint.",
    "",
    "=== OUTPUT SCHEMA ===",
    '{ "id": "<short_id>", "name": "string", "description": "string", "tags": ["string"],',
    '  "timeoutMs": null, "nodes": [PipelineNode], "edges": [PipelineEdge] }',
    "",
    ...(skillReferences
      ? [
          "=== REFERENCE DOCUMENTATION ===",
          "The following is the canonical documentation for node types and pipeline anatomy.",
          "Use this as your primary reference for constructing nodes and edges.",
          "",
          skillReferences,
          "",
        ]
      : [
          "=== NODE TYPES ===",
          "",
          "1. INPUT — github-project:",
          '{ "id": "<unique>", "type": "github-projects", "position": {"x":0,"y":0},',
          '  "data": { "nodeType": "github-projects", "label": "...", "owner": "<github-owner>",',
          '    "repo": "<repo-name>", "branch": "main", "sourceType": "github",',
          '    "accessMode": "remote", "disclosureMode": "tree" } }',
          "",
          "2. INPUT — folder:",
          '{ "id": "<unique>", "type": "folder", "position": {"x":0,"y":0},',
          '  "data": { "nodeType": "folder", "label": "...", "folderPath": "/path/to/folder" } }',
          "",
          "3. INPUT — prompt (text/instruction input, NOT tied to any file or folder):",
          '{ "id": "<unique>", "type": "prompt", "position": {"x":0,"y":0},',
          '  "data": { "nodeType": "prompt", "label": "...", "prompt": "<the prompt text>" } }',
          "",
          "4. OPERATION — processing step:",
          '{ "id": "<unique>", "type": "operation", "position": {"x":<step*400>,"y":0},',
          '  "data": { "nodeType": "operation", "label": "...", "operationId": "<from list>",',
          '    "operationName": "<from list>", "status": "idle" } }',
          "",
          "5. OUTPUT — output-local-path:",
          '{ "id": "<unique>", "type": "output-local-path", "position": {"x":<last>,"y":0},',
          '  "data": { "nodeType": "output-local-path", "label": "Output",',
          '    "localPath": "/tmp/ordine-output" } }',
          "",
        ]),
    'Each edge: { "id": "<unique>", "source": "<nodeId>", "target": "<nodeId>" }',
    "",
    "=== STRUCTURAL RULES ===",
    "- Pipeline MUST have at least 1 input node (github-project, folder, or prompt)",
    "- Pipeline MUST have at least 1 output node (output-local-path)",
    "- Pipeline MUST have a complete path: input → operation(s) → output",
    "- Use ONLY operations from the provided operations list (match by id and name)",
    '- For github-project nodes: sourceType MUST be "github" or "local" (NOT "remote")',
    "- Infer input node type and details from the original pipeline and job context",
    "- Arrange nodes LEFT TO RIGHT with ~400px horizontal spacing (same y=0)",
    "",
    "=== OPTIMIZATION PRINCIPLES ===",
    "- If the distillation says token/cost is too high, REDUCE the number of LLM agent nodes",
    "- If the distillation says runtime is too slow, SPLIT work into parallel branches or use simpler ops",
    "- If the distillation says output was lost, ADD output-local-path nodes",
    "- If a minimalPath step doesn't map to an existing operation, pick the closest available one",
    "- Preserve the original pipeline's input sources (same repo, same folder) but optimize the processing",
    "- The description MUST explain WHAT was optimized and WHY, referencing specific distillation insights",
    "",
    "=== OPERATION SELECTION RULES ===",
    "- ONLY use operations whose purpose logically matches the pipeline's task",
    "- Check each operation's acceptedObjectTypes — it must accept the type flowing from the previous node",
    "  - github-project nodes produce 'github-project' type",
    "  - folder nodes produce 'folder' type",
    "  - code-file nodes produce 'file' or 'code-file' type",
    "- Do NOT add extra operations just to fill space. If only 1 operation is relevant, use only 1",
    "- If the minimalPath suggests a step but no matching operation exists, SKIP that step rather than picking an unrelated operation",
    "- Prefer reusing the SAME operations from the original pipeline unless the distillation explicitly says to replace them",
    "",
    "=== PATH RULES (CRITICAL) ===",
    "- All file/folder paths MUST be absolute (starting with /). NEVER use ~ or ~/.",
    `- The current user's home directory is: ${homedir()}`,
    `- 'Desktop' means: ${join(homedir(), "Desktop")}`,
    `- 'Documents' means: ${join(homedir(), "Documents")}`,
    "- If you cannot determine the absolute path, use /tmp/ordine-output as fallback.",
    "",
    "Return ONLY the JSON object. No markdown, no explanation, no code fences.",
  ].join("\n");

const MAX_SNAPSHOT_CHARS = 20_000;
const truncate = (text: string, max: number) =>
  text.length <= max ? text : `${text.slice(0, max)}\n... (truncated)`;

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
      return validateOperationNodeCatalog(
        action.nodeId,
        action.data,
        operationById,
        actionIndex,
      );
    }

    return [];
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
        : typeof rawActionRecord.op === "string" &&
            rawActionRecord.op in ACTION_TYPE_ALIASES
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
          ...(typeof nodeRecord.folderPath === "string" ? { folderPath: nodeRecord.folderPath } : {}),
          ...(typeof nodeRecord.localPath === "string" ? { localPath: nodeRecord.localPath } : {}),
          ...(typeof nodeRecord.projectPath === "string" ? { projectPath: nodeRecord.projectPath } : {}),
          ...(typeof nodeRecord.operationId === "string" ? { operationId: nodeRecord.operationId } : {}),
          ...(typeof nodeRecord.operationName === "string" ? { operationName: nodeRecord.operationName } : {}),
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
          dataRecord.position && typeof dataRecord.position === "object" && !Array.isArray(dataRecord.position)
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
      actionRecord.node && typeof actionRecord.node === "object" && !Array.isArray(actionRecord.node)
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
    const inferredNodeType =
      parsedDataNodeType?.success
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

export const createPipelinesService = (db: DbConnection) => {
  const agentRuntimesDao = createAgentRuntimesDao(db);
  const dao = createPipelinesDao(db);
  const distillationsDao = createDistillationsDao(db);
  const jobsDao = createJobsDao(db);
  const pipelineRunsDao = createPipelineRunsDao(db);
  const jobTracesDao = createJobTracesDao(db);
  const operationsDao = createOperationsDao(db);
  const settingsDao = createSettingsDao(db);

  return {
    getAll: () => dao.findMany(),
    getById: (id: string) => dao.findById(id),
    create: (...args: Parameters<typeof dao.create>) => dao.create(...args),
    createPendingOperations: async (
      pendingOperations: Array<{
        id: string;
        name: string;
        description: string;
        config: Record<string, unknown>;
        acceptedObjectTypes: ObjectNodeType[];
      }>,
    ) => {
      for (const op of pendingOperations) {
        await operationsDao.create(op);
      }
    },
    update: (...args: Parameters<typeof dao.update>) => dao.update(...args),
    delete: async (id: string) => {
      await pipelineRunsDao.deleteByPipelineId(id);
      await dao.delete(id);
    },

    proposeActions: async (opts: {
      snapshot: PipelineGraphSnapshot;
      message: string;
      pipelineId?: string;
      pipelineName?: string;
      runtimeId?: string;
    }): Promise<{
      proposal: PipelineActionProposal | null;
      diagnostics: PipelineActionDiagnostic[];
      reply?: string;
    }> => {
      const parsedSnapshot = PipelineGraphSnapshotSchema.safeParse(opts.snapshot);
      if (!parsedSnapshot.success) {
        logger.warn(
          { error: parsedSnapshot.error },
          "proposeActions: invalid pipeline graph snapshot",
        );

        return { proposal: null, diagnostics: [] };
      }

      const snapshot = parsedSnapshot.data;
      const settings = normalizeSettingsRecord(await settingsDao.get());
      const configuredRuntimes = await agentRuntimesDao.findMany();
      const selectedRuntime = opts.runtimeId
        ? configuredRuntimes.find((runtime) => runtime.id === opts.runtimeId) ?? null
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
              ssh: effectiveRuntime?.connection.mode === "ssh" ? effectiveRuntime.connection : undefined,
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
        logger.error(
          { err: execution?.error },
          "proposeActions: agent failed after retries",
        );

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

      const proposal = parsed.data;
      const validationResult = validatePipelineActions(snapshot, proposal.actions);
      const graphDiagnostics = validationResult.isErr() ? validationResult.error : [];
      const operationDiagnostics = validateProposalActionCatalog(
        proposal.actions,
        operationById,
      );

      return {
        proposal,
        diagnostics: [...graphDiagnostics, ...operationDiagnostics],
      };
    },

    optimizeFromDistillation: async (opts: {
      distillationId: string;
      userPrompt: string;
    }): Promise<PipelineData | undefined> => {
      const distillationRecord = await distillationsDao.findById(opts.distillationId);
      if (!distillationRecord) return undefined;

      const settings = normalizeSettingsRecord(await settingsDao.get());
      const operations = await operationsDao.findMany();

      const context = { jobContext: "", sourcePipelineContext: "" };
      if (distillationRecord.sourceType === "job" && distillationRecord.sourceId) {
        const [job, traces] = await Promise.all([
          jobsDao.findById(distillationRecord.sourceId),
          jobTracesDao.findByJobId(distillationRecord.sourceId),
        ]);
        context.jobContext = [
          "Source Job:",
          truncate(JSON.stringify(job, null, 2), MAX_SNAPSHOT_CHARS),
          "",
          `Traces (${traces.length}):`,
          truncate(
            JSON.stringify(
              traces.slice(0, 40).map((t) => ({ level: t.level, message: t.message })),
              null,
              2,
            ),
            MAX_SNAPSHOT_CHARS,
          ),
        ].join("\n");

        if (job) {
          const pipelineRun = await pipelineRunsDao.findByJobId(job.id);
          if (pipelineRun?.pipelineId) {
            const sourcePipeline = await dao.findById(pipelineRun.pipelineId);
            if (sourcePipeline) {
              context.sourcePipelineContext = [
                "Original Pipeline (use this as reference for input/output nodes):",
                truncate(JSON.stringify(sourcePipeline, null, 2), MAX_SNAPSHOT_CHARS),
              ].join("\n");
            }
          }
        }
      }

      // Build structured distillation sections for the prompt
      const distResult = distillationRecord.result as Record<string, unknown> | null;
      const nextActions = Array.isArray(distResult?.nextActions)
        ? (distResult.nextActions as string[]).map((a, i) => `  ${i + 1}. ${a}`).join("\n")
        : "(none)";
      const minimalPath = Array.isArray(distResult?.minimalPath)
        ? (distResult.minimalPath as string[]).map((s, i) => `  ${i + 1}. ${s}`).join("\n")
        : "(none)";
      const insights = Array.isArray(distResult?.insights)
        ? (distResult.insights as string[]).map((s, i) => `  ${i + 1}. ${s}`).join("\n")
        : "(none)";
      const reusableAssets = Array.isArray(distResult?.reusableAssets)
        ? truncate(JSON.stringify(distResult.reusableAssets, null, 2), MAX_SNAPSHOT_CHARS)
        : "(none)";

      const userPromptText = [
        "=== REQUIRED ACTIONS (implement ALL of these) ===",
        nextActions,
        "",
        "=== OPTIMAL EXECUTION PATH (design pipeline to follow this) ===",
        minimalPath,
        "",
        "=== INSIGHTS (problems to fix) ===",
        insights,
        "",
        "=== REUSABLE ASSETS (use as blueprint if applicable) ===",
        reusableAssets,
        "",
        "=== ORIGINAL PIPELINE (preserve input sources, optimize processing) ===",
        context.sourcePipelineContext || "(no source pipeline found)",
        "",
        `=== AVAILABLE OPERATIONS (${operations.length}) ===`,
        JSON.stringify(
          operations.map((op) => ({
            id: op.id,
            name: op.name,
            description: op.description,
            acceptedObjectTypes: op.acceptedObjectTypes,
          })),
          null,
          2,
        ),
        "",
        "=== ADDITIONAL CONTEXT ===",
        `User guidance: ${opts.userPrompt}`,
        `Distillation summary: ${distResult?.summary ?? ""}`,
        "",
        context.jobContext ? `Source job context:\n${context.jobContext}` : "",
        "",
        "Generate the optimized pipeline JSON now. Return ONLY the JSON.",
      ].join("\n");

      const optimizePrompt = buildOptimizeSystemPrompt(SKILL_REFERENCES);

      const MAX_RETRIES = 3;
      const execution = await (async () => {
        for (const attempt of Array.from({ length: MAX_RETRIES }, (_, i) => i + 1)) {
          const result = await ResultAsync.fromPromise(
            runAgent({
              agent: settings.defaultAgentRuntime,
              systemPrompt: optimizePrompt,
              userPrompt: userPromptText,
              inputPath: process.cwd(),
              agentId: OPTIMIZE_AGENT_ID,
              allowedTools: [],
              logPrefix: "optimizePipeline",
              apiKey: settings.defaultApiKey,
              model: settings.defaultModel,
            }),
            (cause) => (cause instanceof Error ? cause : new Error(String(cause))),
          );
          if (result.isOk()) return result;
          if (attempt === MAX_RETRIES) return result;
          logger.warn(
            { attempt, err: result.error.message },
            "optimizePipeline: agent attempt failed, retrying",
          );
        }

        return undefined;
      })();

      if (!execution || execution.isErr()) {
        logger.error({ err: execution?.error }, "optimizePipeline: agent failed after retries");

        return undefined;
      }

      const raw = execution.value;
      const json = extractJsonFromText(raw);
      const rawParsed = JSON.parse(json);

      // Sanitize known LLM output issues before Zod validation
      if (Array.isArray(rawParsed.nodes)) {
        for (const node of rawParsed.nodes) {
          if (node.data?.nodeType === "github-projects" && node.data.sourceType === "remote") {
            node.data.sourceType = "github";
          }
        }
      }

      // Ensure unique ID to avoid collisions with existing pipelines
      const existingPipeline = await dao.findById(rawParsed.id);
      if (existingPipeline) {
        rawParsed.id = `${rawParsed.id}_${Date.now()}`;
      }

      const parsed = PipelineSchema.omit({ createdAt: true, updatedAt: true }).safeParse(rawParsed);

      if (!parsed.success) {
        logger.error({ error: parsed.error }, "optimizePipeline: invalid pipeline JSON from agent");

        return undefined;
      }

      const created = await dao.create({
        ...parsed.data,
        nodes: expandTildeInNodes(parsed.data.nodes) as never,
        edges: parsed.data.edges as never,
      });

      return created;
    },

    analyzeIntent: async (opts: {
      name: string;
      description: string;
    }): Promise<{
      matchedOperations: Array<{ operationId: string; operationName: string; reason: string }>;
      unmatchedSteps: Array<{ step: string; reason: string }>;
    }> => {
      const EMPTY = {
        matchedOperations: [] as Array<{
          operationId: string;
          operationName: string;
          reason: string;
        }>,
        unmatchedSteps: [] as Array<{ step: string; reason: string }>,
      };

      if (!opts.description.trim()) {
        return EMPTY;
      }

      const settings = normalizeSettingsRecord(await settingsDao.get());
      const operations = await operationsDao.findMany();

      const userPromptText = [
        "=== PIPELINE GOAL ===",
        `Name: ${opts.name}`,
        `Description: ${opts.description}`,
        "",
        `=== AVAILABLE OPERATIONS (${operations.length}) ===`,
        JSON.stringify(
          operations.map((op) => ({
            id: op.id,
            name: op.name,
            description: op.description,
            acceptedObjectTypes: op.acceptedObjectTypes,
          })),
          null,
          2,
        ),
        "",
        "Analyze the pipeline goal and match against available operations. Return ONLY the JSON.",
      ].join("\n");

      const result = await ResultAsync.fromPromise(
        runAgent({
          agent: settings.defaultAgentRuntime,
          systemPrompt: ANALYZE_SYSTEM_PROMPT,
          userPrompt: userPromptText,
          inputPath: process.cwd(),
          agentId: ANALYZE_AGENT_ID,
          allowedTools: [],
          logPrefix: "analyzeIntent",
          apiKey: settings.defaultApiKey,
          model: settings.defaultModel,
        }),
        (cause) => (cause instanceof Error ? cause : new Error(String(cause))),
      );

      if (result.isErr()) {
        logger.error({ err: result.error }, "analyzeIntent: agent failed");

        return EMPTY;
      }

      const json = extractJsonFromText(result.value);
      const parseResult = Result.fromThrowable(
        () => JSON.parse(json) as Record<string, unknown>,
        () => new Error("Invalid JSON"),
      )();

      if (parseResult.isErr()) {
        logger.error("analyzeIntent: failed to parse agent output as JSON");

        return EMPTY;
      }

      const parsed = parseResult.value;
      const matchedOperations = Array.isArray(parsed.matchedOperations)
        ? (parsed.matchedOperations as Array<{
            operationId: string;
            operationName: string;
            reason: string;
          }>)
        : [];
      const unmatchedSteps = Array.isArray(parsed.unmatchedSteps)
        ? (parsed.unmatchedSteps as Array<{ step: string; reason: string }>)
        : [];

      return { matchedOperations, unmatchedSteps };
    },

    generateStructure: async (opts: {
      name: string;
      description: string;
      matchedOperations?: Array<{ operationId: string; operationName: string; reason: string }>;
      unmatchedSteps?: Array<{ step: string; reason: string }>;
    }): Promise<
      | {
          nodes: PipelineData["nodes"];
          edges: PipelineData["edges"];
          pendingOperations?: Array<{
            id: string;
            name: string;
            description: string;
            config: Record<string, unknown>;
            acceptedObjectTypes: ObjectNodeType[];
          }>;
        }
      | { error: string }
    > => {
      if (!opts.description.trim()) {
        return { nodes: [] as PipelineData["nodes"], edges: [] as PipelineData["edges"] };
      }

      const settings = normalizeSettingsRecord(await settingsDao.get());
      const operations = await operationsDao.findMany();

      const pendingOperations: Array<{
        id: string;
        name: string;
        description: string;
        config: Record<string, unknown>;
        acceptedObjectTypes: ObjectNodeType[];
      }> = [];
      const newOperations: Array<{ id: string; name: string; description: string }> = [];

      if (opts.unmatchedSteps && opts.unmatchedSteps.length > 0) {
        for (const step of opts.unmatchedSteps) {
          const opId = `op_auto_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          const systemPrompt = [
            `You are an automation agent executing the task: "${step.step}".`,
            step.reason ? `Context: ${step.reason}` : "",
            "",
            "You will receive input data from the previous pipeline step.",
            "Analyze the input thoroughly and execute the task described above.",
            "Output your results in well-structured markdown format.",
            "Be specific, actionable, and data-driven in your output.",
          ]
            .filter(Boolean)
            .join("\n");
          const config = {
            executor: {
              type: "agent",
              agentMode: "prompt",
              prompt: systemPrompt,
            },
            inputs: [],
            outputs: [
              {
                name: "result",
                contentType: "markdown",
                description: "Generated result",
                templateIds: [],
              },
            ],
          };
          pendingOperations.push({
            id: opId,
            name: step.step,
            description: step.reason,
            config,
            acceptedObjectTypes: ["file", "folder", "github-project", "prompt"] as ObjectNodeType[],
          });
          newOperations.push({ id: opId, name: step.step, description: step.reason });
          logger.info(
            { opId, name: step.step },
            "generateStructure: prepared pending operation for unmatched step",
          );
        }
      }

      const allOperations = [
        ...operations.map((op) => ({
          id: op.id,
          name: op.name,
          description: op.description,
          acceptedObjectTypes: op.acceptedObjectTypes,
        })),
        ...newOperations.map((op) => ({
          id: op.id,
          name: op.name,
          description: op.description,
          acceptedObjectTypes: ["file", "folder", "github-project", "prompt"] as ObjectNodeType[],
        })),
      ];

      const matchedBlock =
        opts.matchedOperations && opts.matchedOperations.length > 0
          ? [
              "",
              "=== PRE-MATCHED OPERATIONS (MUST USE) ===",
              "The following operations have already been confirmed as matching the user's intent.",
              "You MUST include ALL of them as operation nodes in the pipeline, using the EXACT operationId and operationName.",
              "Do NOT substitute, skip, or replace any of these with other operations.",
              JSON.stringify(opts.matchedOperations, null, 2),
              "",
            ]
          : [];

      const newOpsBlock =
        newOperations.length > 0
          ? [
              "",
              "=== NEWLY CREATED OPERATIONS (MUST USE) ===",
              "The following operations were just created specifically for this pipeline's unmatched steps.",
              "You MUST include ALL of them as operation nodes in the pipeline, using the EXACT id and name.",
              JSON.stringify(newOperations, null, 2),
              "",
            ]
          : [];

      const userPromptText = [
        `=== PIPELINE GOAL ===`,
        `Name: ${opts.name}`,
        `Description: ${opts.description}`,
        ...matchedBlock,
        ...newOpsBlock,
        `=== AVAILABLE OPERATIONS (${allOperations.length}) ===`,
        JSON.stringify(allOperations, null, 2),
        "",
        "Generate the pipeline structure JSON now. Return ONLY the JSON with nodes and edges.",
      ].join("\n");

      const systemPrompt = buildGenerateSystemPrompt(SKILL_REFERENCES);

      const MAX_RETRIES = 3;
      const execution = await (async () => {
        for (const attempt of Array.from({ length: MAX_RETRIES }, (_, i) => i + 1)) {
          const result = await ResultAsync.fromPromise(
            runAgent({
              agent: settings.defaultAgentRuntime,
              systemPrompt,
              userPrompt: userPromptText,
              inputPath: process.cwd(),
              agentId: GENERATE_AGENT_ID,
              allowedTools: [],
              logPrefix: "generateStructure",
              apiKey: settings.defaultApiKey,
              model: settings.defaultModel,
            }),
            (cause) => (cause instanceof Error ? cause : new Error(String(cause))),
          );
          if (result.isOk()) return result;
          if (attempt === MAX_RETRIES) return result;
          logger.warn(
            { attempt, err: result.error.message },
            "generateStructure: agent attempt failed, retrying",
          );
        }

        return undefined;
      })();

      if (!execution || execution.isErr()) {
        logger.error({ err: execution?.error }, "generateStructure: agent failed after retries");

        return { error: "Agent failed to generate pipeline structure after retries" };
      }

      const raw = execution.value;
      const json = extractJsonFromText(raw);

      const parseResult = Result.fromThrowable(
        () => JSON.parse(json) as Record<string, unknown>,
        () => new Error("Invalid JSON"),
      )();

      if (parseResult.isErr()) {
        logger.error("generateStructure: failed to parse agent output as JSON");

        return { error: "Agent returned invalid JSON" };
      }

      const NodesEdgesSchema = PipelineSchema.pick({ nodes: true, edges: true });
      const validated = NodesEdgesSchema.safeParse(parseResult.value);

      if (!validated.success) {
        logger.error({ error: validated.error }, "generateStructure: invalid structure from agent");

        return { error: "Agent returned invalid pipeline structure" };
      }

      return {
        nodes: expandTildeInNodes(validated.data.nodes),
        edges: validated.data.edges,
        ...(pendingOperations.length > 0 ? { pendingOperations } : {}),
      };
    },
  };
};
