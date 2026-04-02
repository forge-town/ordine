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
  type SkillNodeData,
  type ConditionNodeData,
  type OutputNodeData,
  type CodeFileNodeData,
  type FolderNodeData,
  type GitHubProjectNodeData,
  type PipelineNodeData,
  type PipelineEdgeData,
} from "../nodeSchemas";

// Re-export all data types from the single source of truth
export type {
  NodeType,
  NodeRunStatus,
  SkillNodeData,
  ConditionNodeData,
  OutputNodeData,
  CodeFileNodeData,
  FolderNodeData,
  GitHubProjectNodeData,
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

  onNodesChange: (changes: NodeChange<PipelineNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<PipelineEdge>[]) => void;
  onConnect: (connection: Connection) => void;
  addNode: (node: PipelineNode) => void;
  addNodeWithEdge: (sourceId: string, targetType: NodeType) => void;
  removeNode: (nodeId: string) => void;
  updateNodeData: (nodeId: string, data: Record<string, unknown>) => void;
  updateEdgeData: (edgeId: string, data: Partial<PipelineEdgeData>) => void;
  selectNode: (nodeId: string | null) => void;
  selectEdge: (edgeId: string | null) => void;
  duplicateNode: (nodeId: string) => void;
  clearCanvas: () => void;
}

const initialNodes: PipelineNode[] = [];

const initialEdges: PipelineEdge[] = [];

export const createCanvasSlice = (
  set: Parameters<HarnessCanvasStoreSlice>[0],
  overrideNodes?: PipelineNode[],
  overrideEdges?: PipelineEdge[],
): CanvasSlice => ({
  nodes: overrideNodes ?? initialNodes,
  edges: overrideEdges ?? initialEdges,
  selectedNodeId: null,
  selectedEdgeId: null,

  onNodesChange: (changes) => {
    set((state) => ({
      nodes: applyNodeChanges(changes, state.nodes),
    }));
  },

  onEdgesChange: (changes) => {
    set((state) => ({
      edges: applyEdgeChanges(changes, state.edges),
    }));
  },

  onConnect: (connection) => {
    set((state) => {
      const sourceNode = state.nodes.find((n) => n.id === connection.source);
      const targetNode = state.nodes.find((n) => n.id === connection.target);
      if (!sourceNode || !targetNode) return state;

      const result = ConnectionRuleSchema.safeParse({
        sourceType: sourceNode.type,
        targetType: targetNode.type,
      });
      if (!result.success) {
        console.warn("[Canvas] 不允许的连接:", result.error.issues[0]?.message);
        return state;
      }

      return {
        edges: addEdge(
          {
            ...connection,
            type: "default",
            animated: targetNode.type !== "output",
            data: {},
          },
          state.edges,
        ),
      };
    });
  },

  addNode: (node) => {
    set((state) => ({ nodes: [...state.nodes, node] }));
  },

  addNodeWithEdge: (sourceId, targetType) => {
    set((state) => {
      const source = state.nodes.find((n) => n.id === sourceId);
      if (!source) return state;

      const newId = `${targetType}-${Date.now()}`;
      const newNode: PipelineNode = {
        id: newId,
        type: targetType,
        position: {
          x: source.position.x + 300,
          y: source.position.y,
        },
        data: makeDefaultNodeData(targetType),
      };

      const newEdge: PipelineEdge = {
        id: `e-${sourceId}-${newId}`,
        source: sourceId,
        target: newId,
        type: "default",
        animated: targetType !== "output",
        data: {},
      };

      return {
        nodes: [...state.nodes, newNode],
        edges: [...state.edges, newEdge],
      };
    });
  },

  removeNode: (nodeId) => {
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== nodeId),
      edges: state.edges.filter(
        (e) => e.source !== nodeId && e.target !== nodeId,
      ),
      selectedNodeId:
        state.selectedNodeId === nodeId ? null : state.selectedNodeId,
    }));
  },

  updateNodeData: (nodeId, data) => {
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === nodeId
          ? { ...n, data: { ...n.data, ...data } as PipelineNodeData }
          : n,
      ),
    }));
  },

  updateEdgeData: (edgeId, data) => {
    set((state) => ({
      edges: state.edges.map((e) =>
        e.id === edgeId ? { ...e, data: { ...e.data, ...data } } : e,
      ),
    }));
  },

  selectNode: (nodeId) => {
    set({ selectedNodeId: nodeId, selectedEdgeId: null });
  },

  selectEdge: (edgeId) => {
    set({ selectedEdgeId: edgeId, selectedNodeId: null });
  },

  duplicateNode: (nodeId) => {
    set((state) => {
      const source = state.nodes.find((n) => n.id === nodeId);
      if (!source) return state;
      const newId = `${source.type}-${Date.now()}`;
      const newNode: PipelineNode = {
        ...source,
        id: newId,
        position: { x: source.position.x + 40, y: source.position.y + 40 },
        selected: false,
        data: { ...source.data },
      };
      return { nodes: [...state.nodes, newNode] };
    });
  },

  clearCanvas: () => {
    set({ nodes: [], edges: [], selectedNodeId: null, selectedEdgeId: null });
  },
});
