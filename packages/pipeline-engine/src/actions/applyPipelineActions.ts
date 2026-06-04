import { err, ok, type Result } from "neverthrow";
import {
  BuiltinNodeTypeSchema,
  type PipelineGraphSnapshot,
  type PipelineAction,
  type PipelineActionDiagnostic,
} from "@repo/schemas";
import { isConnectionAllowed } from "../schemas/nodes/NodeConnectionRulesSchema";

type PipelineGraphNode = PipelineGraphSnapshot["nodes"][number];

const cloneSnapshot = (snapshot: PipelineGraphSnapshot): PipelineGraphSnapshot => ({
  nodes: structuredClone(snapshot.nodes),
  edges: structuredClone(snapshot.edges),
});

const makeDiagnostic = (
  code: PipelineActionDiagnostic["code"],
  message: string,
  actionIndex: number,
): PipelineActionDiagnostic => ({
  code,
  message,
  actionIndex,
  severity: "error",
});

const isCompoundNode = (node: PipelineGraphNode): boolean =>
  node.type === "compound" || node.data.nodeType === "compound";

const isChildNode = (node: PipelineGraphNode): boolean => typeof node.parentId === "string";

const validateSupportedNode = (
  node: PipelineGraphNode,
  actionIndex: number,
): PipelineActionDiagnostic[] => {
  if (isCompoundNode(node)) {
    return [
      makeDiagnostic(
        "COMPOUND_NODE_NOT_SUPPORTED",
        `Compound node "${node.id}" is not supported by AI graph edits in v1.`,
        actionIndex,
      ),
    ];
  }

  if (isChildNode(node)) {
    return [
      makeDiagnostic(
        "CHILD_NODE_NOT_SUPPORTED",
        `Child node "${node.id}" is not supported by AI graph edits in v1.`,
        actionIndex,
      ),
    ];
  }

  return [];
};

const validateConnection = (
  sourceNode: PipelineGraphNode,
  targetNode: PipelineGraphNode,
  actionIndex: number,
): PipelineActionDiagnostic[] => {
  const sourceType = BuiltinNodeTypeSchema.safeParse(sourceNode.type);
  const targetType = BuiltinNodeTypeSchema.safeParse(targetNode.type);

  if (!sourceType.success || !targetType.success) {
    return [
      makeDiagnostic(
        "INVALID_CONNECTION",
        `Connection ${sourceNode.id} -> ${targetNode.id} uses unsupported node types for AI graph edits.`,
        actionIndex,
      ),
    ];
  }

  if (!isConnectionAllowed(sourceType.data, targetType.data)) {
    return [
      makeDiagnostic(
        "INVALID_CONNECTION",
        `Connection ${sourceNode.id} -> ${targetNode.id} violates pipeline connection rules.`,
        actionIndex,
      ),
    ];
  }

  return [];
};

const validateNodeDataMatch = (
  node: PipelineGraphNode,
  action: Extract<PipelineAction, { type: "replaceNodeData" }>,
  actionIndex: number,
): PipelineActionDiagnostic[] =>
  node.type === action.data.nodeType
    ? []
    : [
        makeDiagnostic(
          "INVALID_NODE_DATA",
          `Replacement data for node "${node.id}" must keep nodeType "${node.type}".`,
          actionIndex,
        ),
      ];

const validateNodeTypeMatchesData = (
  node: PipelineGraphNode,
  actionIndex: number,
): PipelineActionDiagnostic[] =>
  node.type === node.data.nodeType
    ? []
    : [
        makeDiagnostic(
          "INVALID_NODE_DATA",
          `Node "${node.id}" type "${node.type}" must match data.nodeType "${node.data.nodeType}".`,
          actionIndex,
        ),
      ];

const applyAction = (
  draft: PipelineGraphSnapshot,
  action: PipelineAction,
  actionIndex: number,
): PipelineActionDiagnostic[] => {
  switch (action.type) {
    case "addNode": {
      const unsupported = validateSupportedNode(action.node, actionIndex);
      if (unsupported.length > 0) {
        return unsupported;
      }

      const nodeDataDiagnostics = validateNodeTypeMatchesData(action.node, actionIndex);
      if (nodeDataDiagnostics.length > 0) {
        return nodeDataDiagnostics;
      }

      if (draft.nodes.some((node) => node.id === action.node.id)) {
        return [
          makeDiagnostic(
            "DUPLICATE_NODE_ID",
            `Node "${action.node.id}" already exists.`,
            actionIndex,
          ),
        ];
      }

      draft.nodes.push(action.node);

      return [];
    }

    case "removeNode": {
      const node = draft.nodes.find((entry) => entry.id === action.nodeId);
      if (!node) {
        return [
          makeDiagnostic("NODE_NOT_FOUND", `Node "${action.nodeId}" was not found.`, actionIndex),
        ];
      }

      const unsupported = validateSupportedNode(node, actionIndex);
      if (unsupported.length > 0) {
        return unsupported;
      }

      draft.nodes = draft.nodes.filter((entry) => entry.id !== action.nodeId);
      draft.edges = draft.edges.filter(
        (edge) => edge.source !== action.nodeId && edge.target !== action.nodeId,
      );

      return [];
    }

    case "addEdge": {
      if (draft.edges.some((edge) => edge.id === action.edge.id)) {
        return [
          makeDiagnostic(
            "DUPLICATE_EDGE_ID",
            `Edge "${action.edge.id}" already exists.`,
            actionIndex,
          ),
        ];
      }

      const sourceNode = draft.nodes.find((entry) => entry.id === action.edge.source);
      const targetNode = draft.nodes.find((entry) => entry.id === action.edge.target);
      if (!sourceNode || !targetNode) {
        return [
          makeDiagnostic(
            "NODE_NOT_FOUND",
            `Edge "${action.edge.id}" references a missing node.`,
            actionIndex,
          ),
        ];
      }

      const unsupported = [
        ...validateSupportedNode(sourceNode, actionIndex),
        ...validateSupportedNode(targetNode, actionIndex),
      ];
      if (unsupported.length > 0) {
        return unsupported;
      }

      const connectionDiagnostics = validateConnection(sourceNode, targetNode, actionIndex);
      if (connectionDiagnostics.length > 0) {
        return connectionDiagnostics;
      }

      draft.edges.push(action.edge);

      return [];
    }

    case "removeEdge": {
      const edge = draft.edges.find((entry) => entry.id === action.edgeId);
      if (!edge) {
        return [
          makeDiagnostic("EDGE_NOT_FOUND", `Edge "${action.edgeId}" was not found.`, actionIndex),
        ];
      }

      const sourceNode = draft.nodes.find((entry) => entry.id === edge.source);
      const targetNode = draft.nodes.find((entry) => entry.id === edge.target);
      const unsupported = [
        ...(sourceNode ? validateSupportedNode(sourceNode, actionIndex) : []),
        ...(targetNode ? validateSupportedNode(targetNode, actionIndex) : []),
      ];
      if (unsupported.length > 0) {
        return unsupported;
      }

      draft.edges = draft.edges.filter((entry) => entry.id !== action.edgeId);

      return [];
    }

    case "reconnectEdge": {
      const edge = draft.edges.find((entry) => entry.id === action.edgeId);
      if (!edge) {
        return [
          makeDiagnostic("EDGE_NOT_FOUND", `Edge "${action.edgeId}" was not found.`, actionIndex),
        ];
      }

      const sourceNode = draft.nodes.find((entry) => entry.id === action.source);
      const targetNode = draft.nodes.find((entry) => entry.id === action.target);
      if (!sourceNode || !targetNode) {
        return [
          makeDiagnostic(
            "NODE_NOT_FOUND",
            `Reconnected edge "${action.edgeId}" references a missing node.`,
            actionIndex,
          ),
        ];
      }

      const unsupported = [
        ...validateSupportedNode(sourceNode, actionIndex),
        ...validateSupportedNode(targetNode, actionIndex),
      ];
      if (unsupported.length > 0) {
        return unsupported;
      }

      const connectionDiagnostics = validateConnection(sourceNode, targetNode, actionIndex);
      if (connectionDiagnostics.length > 0) {
        return connectionDiagnostics;
      }

      edge.source = action.source;
      edge.target = action.target;
      edge.sourceHandle = action.sourceHandle ?? null;
      edge.targetHandle = action.targetHandle ?? null;

      return [];
    }

    case "replaceNodeData": {
      const node = draft.nodes.find((entry) => entry.id === action.nodeId);
      if (!node) {
        return [
          makeDiagnostic("NODE_NOT_FOUND", `Node "${action.nodeId}" was not found.`, actionIndex),
        ];
      }

      const unsupported = validateSupportedNode(node, actionIndex);
      if (unsupported.length > 0) {
        return unsupported;
      }

      const nodeDataDiagnostics = validateNodeDataMatch(node, action, actionIndex);
      if (nodeDataDiagnostics.length > 0) {
        return nodeDataDiagnostics;
      }

      node.data = action.data;

      return [];
    }
  }
};

const runPipelineActions = (
  snapshot: PipelineGraphSnapshot,
  actions: PipelineAction[],
): Result<PipelineGraphSnapshot, PipelineActionDiagnostic[]> => {
  const draft = cloneSnapshot(snapshot);

  for (const [actionIndex, action] of actions.entries()) {
    const diagnostics = applyAction(draft, action, actionIndex);
    if (diagnostics.length > 0) {
      return err(diagnostics);
    }
  }

  return ok(draft);
};

export const validatePipelineActions = (
  snapshot: PipelineGraphSnapshot,
  actions: PipelineAction[],
): Result<void, PipelineActionDiagnostic[]> =>
  runPipelineActions(snapshot, actions).map(() => undefined);

export const applyPipelineActions = (
  snapshot: PipelineGraphSnapshot,
  actions: PipelineAction[],
): Result<PipelineGraphSnapshot, PipelineActionDiagnostic[]> =>
  runPipelineActions(snapshot, actions);
