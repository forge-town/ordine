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
  type InputNodeData,
  type SkillNodeData,
  type ConditionNodeData,
  type OutputNodeData,
  type PipelineNodeData,
  type PipelineEdgeData,
} from "../nodeSchemas";

// Re-export all data types from the single source of truth
export type {
  NodeType,
  NodeRunStatus,
  InputNodeData,
  SkillNodeData,
  ConditionNodeData,
  OutputNodeData,
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
  updateNodeData: (nodeId: string, data: Partial<PipelineNodeData>) => void;
  updateEdgeData: (edgeId: string, data: Partial<PipelineEdgeData>) => void;
  selectNode: (nodeId: string | null) => void;
  selectEdge: (edgeId: string | null) => void;
  clearCanvas: () => void;
}

const initialNodes: PipelineNode[] = [
  {
    id: "input-1",
    type: "input",
    position: { x: 80, y: 200 },
    data: {
      label: "需求输入",
      nodeType: "input",
      contextDescription: "目标：创建一个带有列表和表单的用户管理页面",
      exampleValue: "UserManagementPage，包含 CRUD 功能",
    },
  },
  {
    id: "skill-1",
    type: "skill",
    position: { x: 380, y: 100 },
    data: {
      label: "生成页面结构",
      nodeType: "skill",
      skillName: "page-best-practice",
      params: '{ "pageName": "UserManagementPage", "mode": "unsupervised" }',
      acceptanceCriteria: "输出包含 Wrapper + Content + _store 三层结构",
      status: "idle",
    },
  },
  {
    id: "skill-2",
    type: "skill",
    position: { x: 380, y: 320 },
    data: {
      label: "生成 DAO 层",
      nodeType: "skill",
      skillName: "dao-best-practice",
      params:
        '{ "entity": "user", "operations": ["findAll","findById","create","update","delete"] }',
      acceptanceCriteria: "DAO 文件符合 Drizzle ORM 最佳实践，类型安全",
      status: "idle",
    },
  },
  {
    id: "condition-1",
    type: "condition",
    position: { x: 680, y: 200 },
    data: {
      label: "验收检查",
      nodeType: "condition",
      expression: "index.ts 桶导出存在 && DAO 方法完整 && 无 TypeScript 错误",
      expectedResult: "所有检查项通过",
      status: "idle",
    },
  },
  {
    id: "output-1",
    type: "output",
    position: { x: 960, y: 200 },
    data: {
      label: "模块产出",
      nodeType: "output",
      expectedSchema: "{ pages: string[], dao: string[], service: string[] }",
      notes: "完整的用户管理模块，可直接投入开发",
    },
  },
];

const initialEdges: PipelineEdge[] = [
  {
    id: "e-input-skill1",
    source: "input-1",
    target: "skill-1",
    data: { label: "需求上下文", dataType: "context" },
    type: "smoothstep",
    animated: true,
  },
  {
    id: "e-input-skill2",
    source: "input-1",
    target: "skill-2",
    data: { label: "需求上下文", dataType: "context" },
    type: "smoothstep",
    animated: true,
  },
  {
    id: "e-skill1-cond",
    source: "skill-1",
    target: "condition-1",
    data: { label: "页面产出", dataType: "artifact" },
    type: "smoothstep",
    animated: false,
  },
  {
    id: "e-skill2-cond",
    source: "skill-2",
    target: "condition-1",
    data: { label: "DAO 产出", dataType: "artifact" },
    type: "smoothstep",
    animated: false,
  },
  {
    id: "e-cond-output",
    source: "condition-1",
    target: "output-1",
    data: { label: "验收通过", dataType: "result" },
    type: "smoothstep",
    animated: false,
  },
];

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
            type: "smoothstep",
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
        type: "smoothstep",
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

  clearCanvas: () => {
    set({ nodes: [], edges: [], selectedNodeId: null, selectedEdgeId: null });
  },
});
