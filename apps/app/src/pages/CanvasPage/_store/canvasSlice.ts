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
import {
  makeDefaultNodeData,
  ConnectionRuleSchema,
  type NodeType,
  type NodeRunStatus,
  type CodeFileNodeData,
  type CompoundNodeData,
  type FolderNodeData,
  type GitHubProjectNodeData,
  type OperationNodeData,
  type OutputProjectPathNodeData,
  type OutputLocalPathNodeData,
  type PipelineNodeData,
  type PipelineEdgeData,
} from "../nodeSchemas";

import { computeAutoLayout } from "./autoLayout";

// Re-export all data types from the single source of truth
export type {
  NodeType,
  NodeRunStatus,
  CodeFileNodeData,
  CompoundNodeData,
  FolderNodeData,
  GitHubProjectNodeData,
  OperationNodeData,
  OutputProjectPathNodeData,
  OutputLocalPathNodeData,
  PipelineNodeData,
  PipelineEdgeData,
};

export type PipelineNode = Node<PipelineNodeData, NodeType>;

export type PipelineEdge = Edge<PipelineEdgeData>;

// Keep legacy aliases so imports in other files don't break immediately
export type HarnessNode = PipelineNode;
export type HarnessEdge = PipelineEdge;
export type HarnessNodeData = PipelineNodeData;
export type HarnessEdgeData = PipelineEdgeData;

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

export const createCanvasSlice = (
  set: Parameters<HarnessCanvasStoreSlice>[0],
  get: Parameters<HarnessCanvasStoreSlice>[1],
  overrideNodes?: PipelineNode[],
  overrideEdges?: PipelineEdge[]
): CanvasSlice => ({
  nodes: overrideNodes ?? initialNodes,
  edges: overrideEdges ?? initialEdges,
  selectedNodeId: null,
  selectedEdgeId: null,
  hoveredCompoundId: null,

  handleNodesChange: (changes) => {
    // Position drags — bypass history (noisy), React Flow manages these internally.
    // Only non-position changes (select, remove) go through normal set.
    set((state) => ({
      nodes: applyNodeChanges(changes, state.nodes),
    }));
  },

  handleEdgesChange: (changes) => {
    set((state) => ({
      edges: applyEdgeChanges(changes, state.edges),
    }));
  },

  handleConnect: (connection) => {
    const state = get();
    const sourceNode = state.nodes.find((n) => n.id === connection.source);
    const targetNode = state.nodes.find((n) => n.id === connection.target);
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

    state.recordCommand(
      {
        type: "ADD_EDGE",
        label: `连接 ${sourceNode.data.label} → ${targetNode.data.label}`,
        payload: { source: connection.source, target: connection.target },
      },
      (draft) => {
        draft.edges = addEdge(
          { ...connection, type: "default", animated: true, data: {} },
          draft.edges
        );
      }
    );
  },

  addNode: (node) => {
    get().recordCommand(
      {
        type: "ADD_NODE",
        label: `添加节点 ${node.data.label}`,
        payload: { id: node.id, nodeType: node.type },
      },
      (draft) => {
        draft.nodes.push(node);
      }
    );
  },

  addNodeWithEdge: (sourceId, targetType) => {
    const state = get();
    const source = state.nodes.find((n) => n.id === sourceId);
    if (!source) {
      return;
    }

    const newId = `${targetType}-${Date.now()}`;
    const newNode: PipelineNode = {
      id: newId,
      type: targetType,
      position: { x: source.position.x + 300, y: source.position.y },
      data: makeDefaultNodeData(targetType),
    };
    const newEdge: PipelineEdge = {
      id: `e-${sourceId}-${newId}`,
      source: sourceId,
      target: newId,
      type: "default",
      animated: true,
      data: {},
    };

    state.recordCommand(
      {
        type: "ADD_NODE_WITH_EDGE",
        label: `添加 ${newNode.data.label} 并连接`,
        payload: { sourceId, targetType, newId },
      },
      (draft) => {
        draft.nodes.push(newNode);
        draft.edges.push(newEdge);
      }
    );
  },

  removeNode: (nodeId) => {
    const state = get();
    const node = state.nodes.find((n) => n.id === nodeId);
    if (!node) {
      return;
    }

    state.recordCommand(
      {
        type: "REMOVE_NODE",
        label: `删除节点 ${node.data.label}`,
        payload: { id: nodeId },
      },
      (draft) => {
        draft.nodes = draft.nodes.filter((n) => n.id !== nodeId);
        draft.edges = draft.edges.filter((e) => e.source !== nodeId && e.target !== nodeId);
      }
    );
    // Clear selection outside of history-tracked state
    set((s) => ({
      selectedNodeId: s.selectedNodeId === nodeId ? null : s.selectedNodeId,
    }));
  },

  updateNodeData: (nodeId, data) => {
    const state = get();
    const node = state.nodes.find((n) => n.id === nodeId);
    if (!node) {
      return;
    }

    state.recordCommand(
      {
        type: "UPDATE_NODE_DATA",
        label: `编辑 ${node.data.label}`,
        payload: { id: nodeId, fields: Object.keys(data) },
      },
      (draft) => {
        const n = draft.nodes.find((x) => x.id === nodeId);
        if (n) {
          n.data = { ...n.data, ...data } as PipelineNodeData;
        }
      }
    );
  },

  updateEdgeData: (edgeId, data) => {
    set((state) => ({
      edges: state.edges.map((e) => (e.id === edgeId ? { ...e, data: { ...e.data, ...data } } : e)),
    }));
  },

  selectNode: (nodeId) => {
    set({ selectedNodeId: nodeId, selectedEdgeId: null });
  },

  selectEdge: (edgeId) => {
    set({ selectedEdgeId: edgeId, selectedNodeId: null });
  },

  duplicateNode: (nodeId) => {
    const state = get();
    const source = state.nodes.find((n) => n.id === nodeId);
    if (!source) {
      return;
    }

    const newId = `${source.type}-${Date.now()}`;
    const newNode: PipelineNode = {
      ...source,
      id: newId,
      position: { x: source.position.x + 40, y: source.position.y + 40 },
      selected: false,
      data: { ...source.data },
    };

    state.recordCommand(
      {
        type: "DUPLICATE_NODE",
        label: `复制节点 ${source.data.label}`,
        payload: { sourceId: nodeId, newId },
      },
      (draft) => {
        draft.nodes.push(newNode);
      }
    );
  },

  clearCanvas: () => {
    const state = get();
    state.recordCommand({ type: "CLEAR_CANVAS", label: "清空画布" }, (draft) => {
      draft.nodes = [];
      draft.edges = [];
    });
    set({ selectedNodeId: null, selectedEdgeId: null });
  },

  formatLayout: () => {
    const { nodes, edges } = get();
    const layouted = computeAutoLayout(nodes, edges);
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
        label: `添加 ${node.data.label} 到 ${compound.data.label}`,
        payload: { nodeId, compoundId },
      },
      (draft) => {
        const cNode = draft.nodes.find((n) => n.id === compoundId);
        if (cNode && cNode.data && "childNodeIds" in cNode.data) {
          (cNode.data as CompoundNodeData).childNodeIds.push(nodeId);
        }
        const child = draft.nodes.find((n) => n.id === nodeId);
        if (child) {
          child.parentId = compoundId;
        }
      }
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
        label: `从 ${compound.data.label} 移除 ${node.data.label}`,
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
        }
      }
    );
  },

  groupSelectedNodes: (nodeIds) => {
    const state = get();
    if (nodeIds.length < 2) return;

    const selectedNodes = state.nodes.filter((n) => nodeIds.includes(n.id));
    if (selectedNodes.length < 2) return;

    const compoundId = `compound-${Date.now()}`;
    const compoundData = makeDefaultNodeData("compound") as CompoundNodeData;
    compoundData.childNodeIds = [...nodeIds];
    const newCompound: PipelineNode = {
      id: compoundId,
      type: "compound",
      position: {
        x: Math.min(...selectedNodes.map((n) => n.position.x)) - 40,
        y: Math.min(...selectedNodes.map((n) => n.position.y)) - 40,
      },
      data: compoundData,
    };

    state.recordCommand(
      {
        type: "GROUP_NODES",
        label: `编组 ${nodeIds.length} 个节点`,
        payload: { compoundId, nodeIds },
      },
      (draft) => {
        draft.nodes.push(newCompound);
        const compoundPos = newCompound.position;
        for (const nid of nodeIds) {
          const child = draft.nodes.find((n) => n.id === nid);
          if (child) {
            child.parentId = compoundId;
            child.position = {
              x: child.position.x - compoundPos.x,
              y: child.position.y - compoundPos.y,
            };
          }
        }
      }
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
        label: `解散编组 ${compound.data.label}`,
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
          }
        }
        // Remove compound node and its edges
        draft.nodes = draft.nodes.filter((n) => n.id !== compoundId);
        draft.edges = draft.edges.filter((e) => e.source !== compoundId && e.target !== compoundId);
      }
    );
  },
});
