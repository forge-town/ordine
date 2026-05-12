import {
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type Node,
  type Edge,
  type NodeChange,
  type EdgeChange,
  type Connection,
} from "@xyflow/react";
import type { HarnessCanvasStoreSlice } from "./harnessCanvasStore";
import { makeDefaultNodeData } from "../utils/makeDefaultNodeData";
import type { PipelineNodeData } from "../schemas/PipelineNodeDataSchema";
import { ConnectionRuleSchema } from "@repo/pipeline-engine/schemas";
import type { NodeType, BuiltinNodeType, CompoundNodeData, PipelineEdgeData } from "@repo/schemas";

import { computeAutoLayout } from "./autoLayout";
import { DUPLICATE_NODE_OFFSET, offsetPosition } from "../utils/nodePosition";
import i18n from "@/lib/i18n";

/**
 * Sort nodes so that parents (compound nodes) appear before their children.
 * ReactFlow requires this ordering for parentId/extent to work correctly.
 * Mutates the array in place.
 */
export const sortParentBeforeChildren = (nodes: PipelineNode[]): void => {
  nodes.sort((a, b) => {
    if (a.id === b.parentId) return -1;
    if (b.id === a.parentId) return 1;

    return 0;
  });
};

export type PipelineNode = Node<PipelineNodeData, NodeType>;

export type PipelineEdge = Edge<PipelineEdgeData>;

export interface CanvasSlice {
  nodes: PipelineNode[];
  edges: PipelineEdge[];
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  hoveredCompoundId: string | null;

  handleNodesChange: (changes: NodeChange<PipelineNode>[]) => void;
  handleEdgesChange: (changes: EdgeChange<PipelineEdge>[]) => void;
  handleConnect: (connection: Connection) => void;
  addNode: (node: PipelineNode) => void;
  addNodeWithEdge: (sourceId: string, targetType: NodeType) => void;
  removeNode: (nodeId: string) => void;
  updateNodeData: (nodeId: string, data: Record<string, unknown>) => void;
  updateEdgeData: (edgeId: string, data: Partial<PipelineEdgeData>) => void;
  selectNode: (nodeId: string | null) => void;
  selectEdge: (edgeId: string | null) => void;
  duplicateNode: (nodeId: string) => void;
  clearCanvas: () => void;
  formatLayout: () => void;
  setHoveredCompound: (compoundId: string | null) => void;
  addNodeToCompound: (nodeId: string, compoundId: string) => void;
  removeNodeFromCompound: (nodeId: string, compoundId: string) => void;
  groupSelectedNodes: (nodeIds: string[]) => void;
  ungroupCompound: (compoundId: string) => void;
}

const initialNodes: PipelineNode[] = [];

const initialEdges: PipelineEdge[] = [];

const makeLocalizedDefaultNodeData = (type: BuiltinNodeType) => {
  const fallback = makeDefaultNodeData(type);

  return makeDefaultNodeData(type, {
    label: i18n.t(`canvas.nodeTypes.${type}.label`, { defaultValue: fallback.label }),
  });
};

export const createCanvasSlice = (
  set: Parameters<HarnessCanvasStoreSlice>[0],
  get: Parameters<HarnessCanvasStoreSlice>[1],
  overrideNodes?: PipelineNode[],
  overrideEdges?: PipelineEdge[],
): CanvasSlice => {
  // Ensure parent nodes appear before children on init (ReactFlow requirement)
  const sortedNodes = overrideNodes ? [...overrideNodes] : initialNodes;
  if (overrideNodes) sortParentBeforeChildren(sortedNodes);

  return {
    nodes: sortedNodes,
    edges: overrideEdges ?? initialEdges,
    selectedNodeId: null,
    selectedEdgeId: null,
    hoveredCompoundId: null,

    handleNodesChange: (changes) =>
      set((state) => ({
        nodes: applyNodeChanges(changes, state.nodes),
      })),

    handleEdgesChange: (changes) =>
      set((state) => ({
        edges: applyEdgeChanges(changes, state.edges),
      })),

    handleConnect: (connection) => {
      const { nodes, recordCommand } = get();
      const sourceNode = nodes.find((n) => n.id === connection.source);
      const targetNode = nodes.find((n) => n.id === connection.target);
      if (!sourceNode || !targetNode) {
        return;
      }

      const result = ConnectionRuleSchema.safeParse({
        sourceType: sourceNode.type,
        targetType: targetNode.type,
      });
      if (!result.success) {
        return;
      }

      recordCommand(
        {
          type: "ADD_EDGE",
          label: i18n.t("canvas.history.addEdge", {
            source: sourceNode.data.label,
            target: targetNode.data.label,
          }),
          payload: { source: connection.source, target: connection.target },
        },
        (draft) => {
          draft.edges = addEdge(
            { ...connection, type: "default", animated: true, data: {} },
            draft.edges,
          );
        },
      );
    },

    addNode: (node) => {
      const { recordCommand } = get();

      recordCommand(
        {
          type: "ADD_NODE",
          label: i18n.t("canvas.history.addNode", { label: node.data.label }),
          payload: { id: node.id, nodeType: node.type },
        },
        (draft) => {
          draft.nodes.push(node);
        },
      );
    },

    addNodeWithEdge: (sourceId, targetType) => {
      const { nodes, recordCommand } = get();
      const source = nodes.find((n) => n.id === sourceId);
      if (!source) {
        return;
      }

      const newId = `${targetType}-${Date.now()}`;
      const newNode: PipelineNode = {
        id: newId,
        type: targetType,
        position: { x: source.position.x + 300, y: source.position.y },
        data: makeLocalizedDefaultNodeData(targetType as BuiltinNodeType),
      };
      const newEdge: PipelineEdge = {
        id: `e-${sourceId}-${newId}`,
        source: sourceId,
        target: newId,
        type: "default",
        animated: true,
        data: {},
      };

      recordCommand(
        {
          type: "ADD_NODE_WITH_EDGE",
          label: i18n.t("canvas.history.addNodeWithEdge", { label: newNode.data.label }),
          payload: { sourceId, targetType, newId },
        },
        (draft) => {
          draft.nodes.push(newNode);
          draft.edges.push(newEdge);
        },
      );
    },

    removeNode: (nodeId) => {
      const { nodes, recordCommand } = get();
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) {
        return;
      }

      recordCommand(
        {
          type: "REMOVE_NODE",
          label: i18n.t("canvas.history.removeNode", { label: node.data.label }),
          payload: { id: nodeId },
        },
        (draft) => {
          draft.nodes = draft.nodes.filter((n) => n.id !== nodeId);
          draft.edges = draft.edges.filter((e) => e.source !== nodeId && e.target !== nodeId);
        },
      );
      // Clear selection outside of history-tracked state
      set((s) => ({
        selectedNodeId: s.selectedNodeId === nodeId ? null : s.selectedNodeId,
      }));
    },

    updateNodeData: (nodeId, data) => {
      const { nodes, recordCommand } = get();
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) {
        return;
      }

      recordCommand(
        {
          type: "UPDATE_NODE_DATA",
          label: i18n.t("canvas.history.updateNode", { label: node.data.label }),
          payload: { id: nodeId, fields: Object.keys(data) },
        },
        (draft) => {
          const n = draft.nodes.find((x) => x.id === nodeId);
          if (n) {
            n.data = { ...n.data, ...data } as PipelineNodeData;
          }
        },
      );
    },

    updateEdgeData: (edgeId, data) =>
      set((state) => ({
        edges: state.edges.map((e) =>
          e.id === edgeId ? { ...e, data: { ...e.data, ...data } } : e,
        ),
      })),

    selectNode: (nodeId) => set({ selectedNodeId: nodeId, selectedEdgeId: null }),

    selectEdge: (edgeId) => set({ selectedEdgeId: edgeId, selectedNodeId: null }),

    duplicateNode: (nodeId) => {
      const { nodes, recordCommand } = get();
      const source = nodes.find((n) => n.id === nodeId);
      if (!source) {
        return;
      }

      const newId = `${source.type}-${Date.now()}`;
      const newNode: PipelineNode = {
        ...source,
        id: newId,
        position: offsetPosition(source.position, DUPLICATE_NODE_OFFSET),
        selected: false,
        data: { ...source.data },
      };

      recordCommand(
        {
          type: "DUPLICATE_NODE",
          label: i18n.t("canvas.history.duplicateNode", { label: source.data.label }),
          payload: { sourceId: nodeId, newId },
        },
        (draft) => {
          draft.nodes.push(newNode);
        },
      );
    },

    clearCanvas: () => {
      const { recordCommand } = get();
      recordCommand(
        { type: "CLEAR_CANVAS", label: i18n.t("canvas.history.clearCanvas") },
        (draft) => {
          draft.nodes = [];
          draft.edges = [];
        },
      );
      set({ selectedNodeId: null, selectedEdgeId: null });
    },

    formatLayout: () => {
      const { nodes, edges } = get();
      const layouted = computeAutoLayout(nodes, edges);
      sortParentBeforeChildren(layouted);
      set({ nodes: layouted });
    },

    setHoveredCompound: (compoundId) => {
      set({ hoveredCompoundId: compoundId });
    },

    addNodeToCompound: (nodeId, compoundId) => {
      const state = get();
      const node = state.nodes.find((n) => n.id === nodeId);
      const compound = state.nodes.find((n) => n.id === compoundId);
      if (!node || !compound || compound.type !== "compound") return;

      const compoundData = compound.data as CompoundNodeData;
      if (compoundData.childNodeIds.includes(nodeId)) return;

      state.recordCommand(
        {
          type: "ADD_TO_COMPOUND",
          label: i18n.t("canvas.history.addToCompound", {
            node: node.data.label,
            compound: compound.data.label,
          }),
          payload: { nodeId, compoundId },
        },
        (draft) => {
          const cNode = draft.nodes.find((n) => n.id === compoundId);
          if (cNode && cNode.data && "childNodeIds" in cNode.data) {
            (cNode.data as CompoundNodeData).childNodeIds.push(nodeId);
          }
          const child = draft.nodes.find((n) => n.id === nodeId);
          if (child && cNode) {
            // Convert to relative position
            child.position = {
              x: child.position.x - cNode.position.x,
              y: child.position.y - cNode.position.y,
            };
            child.parentId = compoundId;
            child.extent = "parent";

            // Expand compound to fit all children
            const PAD = 40;
            const allChildIds = (cNode.data as CompoundNodeData).childNodeIds;
            const children = draft.nodes.filter((n) => allChildIds.includes(n.id));
            const childW = 240;
            const childH = 120;
            const minX = Math.min(...children.map((c) => c.position.x));
            const minY = Math.min(...children.map((c) => c.position.y));
            const maxX = Math.max(...children.map((c) => c.position.x + childW));
            const maxY = Math.max(...children.map((c) => c.position.y + childH));
            cNode.style = {
              ...cNode.style,
              width: maxX - minX + PAD * 2,
              height: maxY - minY + PAD * 2 + 36,
            };
          }

          // Ensure parent appears before children in array
          sortParentBeforeChildren(draft.nodes);
        },
      );
    },

    removeNodeFromCompound: (nodeId, compoundId) => {
      const state = get();
      const node = state.nodes.find((n) => n.id === nodeId);
      const compound = state.nodes.find((n) => n.id === compoundId);
      if (!node || !compound || compound.type !== "compound") return;

      state.recordCommand(
        {
          type: "REMOVE_FROM_COMPOUND",
          label: i18n.t("canvas.history.removeFromCompound", {
            node: node.data.label,
            compound: compound.data.label,
          }),
          payload: { nodeId, compoundId },
        },
        (draft) => {
          const cNode = draft.nodes.find((n) => n.id === compoundId);
          if (cNode && cNode.data && "childNodeIds" in cNode.data) {
            const cData = cNode.data as CompoundNodeData;
            cData.childNodeIds = cData.childNodeIds.filter((id) => id !== nodeId);
          }
          const child = draft.nodes.find((n) => n.id === nodeId);
          if (child) {
            // Convert relative position to absolute before detaching
            const compoundPos = draft.nodes.find((n) => n.id === compoundId)?.position;
            if (compoundPos) {
              child.position = {
                x: child.position.x + compoundPos.x,
                y: child.position.y + compoundPos.y,
              };
            }
            child.parentId = undefined;
            child.extent = undefined;
          }
        },
      );
    },

    groupSelectedNodes: (nodeIds) => {
      const state = get();
      if (nodeIds.length < 2) return;

      const selectedNodes = state.nodes.filter((n) => nodeIds.includes(n.id));
      if (selectedNodes.length < 2) return;

      const PAD = 40;
      const HEADER = 36;
      const childW = 240;
      const childH = 120;
      const compoundId = `compound-${Date.now()}`;
      const compoundData = makeLocalizedDefaultNodeData("compound") as CompoundNodeData;
      compoundData.childNodeIds = [...nodeIds];

      const minX = Math.min(...selectedNodes.map((n) => n.position.x));
      const minY = Math.min(...selectedNodes.map((n) => n.position.y));
      const maxX = Math.max(...selectedNodes.map((n) => n.position.x + childW));
      const maxY = Math.max(...selectedNodes.map((n) => n.position.y + childH));

      const compoundPos = { x: minX - PAD, y: minY - PAD - HEADER };
      const newCompound: PipelineNode = {
        id: compoundId,
        type: "compound",
        position: compoundPos,
        style: {
          width: maxX - minX + PAD * 2,
          height: maxY - minY + PAD * 2 + HEADER,
        },
        data: compoundData,
      };

      state.recordCommand(
        {
          type: "GROUP_NODES",
          label: i18n.t("canvas.history.groupNodes", { count: nodeIds.length }),
          payload: { compoundId, nodeIds },
        },
        (draft) => {
          draft.nodes.push(newCompound);
          for (const nid of nodeIds) {
            const child = draft.nodes.find((n) => n.id === nid);
            if (child) {
              child.parentId = compoundId;
              child.extent = "parent";
              child.position = {
                x: child.position.x - compoundPos.x,
                y: child.position.y - compoundPos.y,
              };
            }
          }
          // Ensure parent appears before children in array
          sortParentBeforeChildren(draft.nodes);
        },
      );
    },

    ungroupCompound: (compoundId) => {
      const state = get();
      const compound = state.nodes.find((n) => n.id === compoundId);
      if (!compound || compound.type !== "compound") return;

      const compoundData = compound.data as CompoundNodeData;
      const childIds = compoundData.childNodeIds;

      state.recordCommand(
        {
          type: "UNGROUP_COMPOUND",
          label: i18n.t("canvas.history.ungroupCompound", { label: compound.data.label }),
          payload: { compoundId, childIds },
        },
        (draft) => {
          const compoundPos = draft.nodes.find((n) => n.id === compoundId)?.position;
          for (const cid of childIds) {
            const child = draft.nodes.find((n) => n.id === cid);
            if (child && compoundPos) {
              child.position = {
                x: child.position.x + compoundPos.x,
                y: child.position.y + compoundPos.y,
              };
              child.parentId = undefined;
              child.extent = undefined;
            }
          }
          // Remove compound node and its edges
          draft.nodes = draft.nodes.filter((n) => n.id !== compoundId);
          draft.edges = draft.edges.filter(
            (e) => e.source !== compoundId && e.target !== compoundId,
          );
        },
      );
    },
  };
};
