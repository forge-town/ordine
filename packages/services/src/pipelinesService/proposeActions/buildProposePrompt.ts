import type { ConversationAttachment, PipelineGraphSnapshot } from "@repo/schemas";
import { MAX_SNAPSHOT_CHARS, truncate } from "../promptText";

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
  "- If sample artifacts are provided, reverse-engineer the likely pipeline that would produce them.",
  "- For reverse engineering, infer inputs, transformations, verification, and output targets from artifact names/types plus the user request.",
  "- Return ONLY the JSON object. No markdown, no explanation, no code fences.",
].join("\n");

export type ProposeOperationCatalogItem = {
  id: string;
  name: string;
  description: string | null;
  acceptedObjectTypes: unknown;
};

export type BuildProposeUserPromptInput = {
  attachments: ConversationAttachment[];
  message: string;
  operationCatalog: ProposeOperationCatalogItem[];
  pipelineId?: string;
  pipelineName?: string;
  snapshot: PipelineGraphSnapshot;
};

export const buildProposeUserPrompt = ({
  attachments,
  message,
  operationCatalog,
  pipelineId,
  pipelineName,
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
    ...sampleArtifactBlock,
    "=== USER REQUEST ===",
    message,
    "",
    "Propose the operations now. Return ONLY the JSON object.",
  ].join("\n");
};
