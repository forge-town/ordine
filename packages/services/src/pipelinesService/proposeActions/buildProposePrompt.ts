import type {
  AgentContextPayload,
  ConversationAttachment,
  PipelineGraphSnapshot,
} from "@repo/schemas";
import { MAX_SNAPSHOT_CHARS, truncate } from "../promptText";
import { buildHistoryBlock, type ProposeHistoryMessage } from "./conversationHistory";

const MAX_SELECTION_CHARS = 6000;

export const PROPOSE_AGENT_ID = "pipeline-propose-actions";

export const PROPOSE_SYSTEM_PROMPT = [
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
  "{",
  '  "reply": "<short conversational answer to the user>",',
  '  "clarifyOptions": ["<short answer the user can pick>", ...],  // optional, 2-4 entries, only when clarification is needed',
  '  "newOperations": [{ "id": "op_new_<slug>", "name": "<operation name, user language>", "description": "<one line>", "prompt": "<thorough system prompt for the agent that will execute this step>" }],  // optional, only when no existing operation fits',
  '  "proposal": { "summary": "<what changes and why>", "actions": [ /* array of actions above */ ] } | null',
  "}",
  "",
  "=== RESPONSE RULES ===",
  "- ALWAYS provide a non-empty 'reply', written in the SAME LANGUAGE the user wrote their request in.",
  "- If the request is clear and a safe graph change exists: include 'proposal' and summarize what you changed in 'reply'. Omit 'clarifyOptions'.",
  "- If the request is ambiguous or missing key information: set 'proposal' to null, ask ONE focused clarifying question in 'reply', and offer 2-4 'clarifyOptions'. Each option must be a short ANSWER the user could send back verbatim (an option, not a question).",
  "- If no safe graph change is possible: set 'proposal' to null and explain why in 'reply', plus what the user could do instead.",
  "- Do NOT invent a proposal just to satisfy the schema. A null proposal with a good clarifying question is better than a wrong graph change.",
  "",
  "=== PROPOSAL RULES ===",
  "- The proposal 'summary' field must be a non-empty string explaining the proposed changes.",
  "- When 'proposal' is present, its 'actions' array must contain at least one action.",
  "- All node IDs and edge IDs must be unique within the graph.",
  "- When adding a node, the node 'type' MUST match the 'nodeType' inside its data payload.",
  "- When adding edges, both source and target nodes must already exist in the graph (or be added in a previous operation).",
  "- When replacing node data, the 'nodeType' inside 'data' MUST match the node's existing type.",
  "- When adding or replacing operation nodes, prefer operationId values from the provided available operations list.",
  "- If NO existing operation matches a required step, define a new one in 'newOperations' (unique id starting with op_new_, clear name, and a thorough 'prompt' describing exactly what the step must do with its input). Reference that id from addNode operation nodes.",
  "- Do NOT refuse a request merely because no matching operation exists — define newOperations instead. Only refuse when the request itself is unsafe or impossible.",
  "- For operation nodes, operationName MUST match the referenced operation's name (existing or new).",
  "- Compound nodes (type === 'compound' or data.nodeType === 'compound') are NOT supported.",
  "- Child nodes (nodes with a 'parentId' field) are NOT supported.",
  "- Do NOT propose actions that create compound nodes or child nodes.",
  "- If sample artifacts are provided, reverse-engineer the likely pipeline that would produce them.",
  "- For reverse engineering, infer inputs, transformations, verification, and output targets from artifact names/types plus the user request.",
  "- If an ACTIVE RUN section is present and the user asks about the run (progress, failures, node behavior), ground your 'reply' in those traces — quote the relevant evidence. Only include a proposal if they explicitly ask for a graph change.",
  "- Return ONLY the JSON object. No markdown, no explanation, no code fences.",
].join("\n");

export type ProposeOperationCatalogItem = {
  id: string;
  name: string;
  description: string | null;
  acceptedObjectTypes: unknown;
};

/** 服务端解析好的运行上下文（N12-03）：job + 最近 traces，只有服务端能拿到。 */
export type ProposeActiveRun = {
  jobId: string;
  jobStatus: string;
  nodeStatuses: Record<string, string>;
  traces: { level: string; message: string }[];
};

const MAX_TRACE_MESSAGE_CHARS = 400;

const buildActiveRunBlock = (activeRun?: ProposeActiveRun): string[] => {
  if (!activeRun) {
    return [];
  }

  return [
    "=== ACTIVE RUN ===",
    `Job ${activeRun.jobId} — status: ${activeRun.jobStatus}`,
    `Node statuses: ${JSON.stringify(activeRun.nodeStatuses)}`,
    ...(activeRun.traces.length > 0
      ? [
          `Recent execution traces (oldest first, ${activeRun.traces.length} shown):`,
          ...activeRun.traces.map(
            (trace) => `- [${trace.level}] ${truncate(trace.message, MAX_TRACE_MESSAGE_CHARS)}`,
          ),
        ]
      : ["No traces recorded yet."]),
    "",
  ];
};

export type BuildProposeUserPromptInput = {
  /** 运行期上下文，仅当消息携带 runState 且 job 存在时由服务端填充（N12-03）。 */
  activeRun?: ProposeActiveRun;
  attachments: ConversationAttachment[];
  /** 前端 buildAgentContext 输出（N12-02）。未提供的项不注入也不声称。 */
  context?: AgentContextPayload;
  diagnostics?: string[];
  failedProposal?: unknown;
  history?: ProposeHistoryMessage[];
  message: string;
  operationCatalog: ProposeOperationCatalogItem[];
  pipelineId?: string;
  pipelineName?: string;
  referencedNodeIds?: string[];
  snapshot: PipelineGraphSnapshot;
};

/** 未解决的画布锚点批注：内容已在对话历史里，这里给出位置与计数索引。 */
const buildAnnotationsBlock = (context?: AgentContextPayload): string[] => {
  if (!context || context.anchors.length === 0) {
    return [];
  }

  return [
    "=== USER ANNOTATIONS (unresolved node-anchored notes) ===",
    "The user left unresolved notes anchored to these graph elements.",
    "Their content appears in the conversation history; treat them as open requests tied to the listed elements.",
    ...context.anchors.map(
      (anchor) =>
        `- ${anchor.label ?? anchor.refId} (${anchor.refId}): ${anchor.count} unresolved note(s)`,
    ),
    "",
  ];
};

const buildDiagnosticsBlock = (diagnostics: string[], failedProposal: unknown): string[] => {
  if (diagnostics.length === 0) {
    return [];
  }

  return [
    "=== PREVIOUS PROPOSAL DIAGNOSTICS ===",
    "Your previous proposal failed validation. Fix ALL of the following problems and return a corrected proposal:",
    ...diagnostics.map((diagnostic) => `- ${diagnostic}`),
    ...(failedProposal
      ? [
          "Failed proposal for reference:",
          truncate(JSON.stringify(failedProposal, null, 2), MAX_SELECTION_CHARS),
        ]
      : []),
    "",
  ];
};

type ResolvedSelection = {
  drillPath: string[];
  element: PipelineGraphSnapshot["nodes"][number] | PipelineGraphSnapshot["edges"][number];
  kind: "node" | "edge";
  refId: string;
};

/**
 * Resolve composer ref ids against the current graph. Drill-in refs are encoded
 * as `parent/child` paths — the last segment is the element id on the canvas.
 */
export const resolveSelectedElements = (
  referencedNodeIds: string[],
  snapshot: PipelineGraphSnapshot,
): { resolved: ResolvedSelection[]; missing: string[] } => {
  const resolved: ResolvedSelection[] = [];
  const missing: string[] = [];

  for (const refId of referencedNodeIds) {
    const path = refId.split("/");
    const baseId = path.at(-1) ?? refId;
    const node = snapshot.nodes.find((candidate) => candidate.id === baseId);
    if (node) {
      resolved.push({ drillPath: path.slice(0, -1), element: node, kind: "node", refId });
      continue;
    }

    const edge = snapshot.edges.find((candidate) => candidate.id === baseId);
    if (edge) {
      resolved.push({ drillPath: path.slice(0, -1), element: edge, kind: "edge", refId });
      continue;
    }

    missing.push(refId);
  }

  return { missing, resolved };
};

const buildSelectionBlock = (
  referencedNodeIds: string[],
  snapshot: PipelineGraphSnapshot,
): string[] => {
  if (referencedNodeIds.length === 0) {
    return [];
  }

  const { missing, resolved } = resolveSelectedElements(referencedNodeIds, snapshot);
  if (resolved.length === 0 && missing.length === 0) {
    return [];
  }

  return [
    "=== USER SELECTION ===",
    "The user has explicitly selected the following graph elements before sending this message.",
    "Treat the user's request as targeting these elements. Prefer proposing changes to them",
    "(e.g. replaceNodeData / reconnectEdge on the selected element) unless the request clearly says otherwise.",
    ...(resolved.length > 0
      ? [truncate(JSON.stringify(resolved, null, 2), MAX_SELECTION_CHARS)]
      : []),
    ...(missing.length > 0
      ? [`Referenced ids not found in the current graph (ignore them): ${missing.join(", ")}`]
      : []),
    "",
  ];
};

export const buildProposeUserPrompt = ({
  activeRun,
  attachments,
  context,
  diagnostics = [],
  failedProposal,
  history = [],
  message,
  operationCatalog,
  pipelineId,
  pipelineName,
  referencedNodeIds = [],
  snapshot,
}: BuildProposeUserPromptInput): string => {
  const sampleArtifactBlock =
    attachments.length > 0
      ? [
          "=== SAMPLE ARTIFACTS FOR REVERSE ENGINEERING ===",
          truncate(JSON.stringify(attachments, null, 2), MAX_SNAPSHOT_CHARS),
          "",
          "Use these artifacts as output examples. Infer the upstream pipeline that would create similar results.",
          "",
        ]
      : [];

  return [
    "=== PIPELINE CONTEXT ===",
    `Pipeline ID: ${pipelineId ?? "(unsaved)"}`,
    `Pipeline Name: ${pipelineName ?? "(unnamed)"}`,
    "",
    "=== CURRENT GRAPH ===",
    truncate(JSON.stringify(snapshot, null, 2), MAX_SNAPSHOT_CHARS),
    "",
    `=== AVAILABLE OPERATIONS (${operationCatalog.length}) ===`,
    truncate(JSON.stringify(operationCatalog, null, 2), MAX_SNAPSHOT_CHARS),
    "",
    ...buildHistoryBlock(history),
    ...buildSelectionBlock(referencedNodeIds, snapshot),
    ...buildAnnotationsBlock(context),
    ...buildActiveRunBlock(activeRun),
    ...buildDiagnosticsBlock(diagnostics, failedProposal),
    ...sampleArtifactBlock,
    "=== USER REQUEST ===",
    message,
    "",
    "Propose the operations now. Return ONLY the JSON object.",
  ].join("\n");
};
