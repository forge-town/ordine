import { create } from "zustand";
import type {
  PipelineNode,
  PipelineEdge,
} from "@/pages/HarnessCanvasPage/_store/canvasSlice";

export interface Pipeline {
  id: string;
  name: string;
  description: string;
  tags: string[];
  nodeCount: number;
  createdAt: number;
  updatedAt: number;
  nodes: PipelineNode[];
  edges: PipelineEdge[];
}

// ─── Sample Pipeline 1: User Management Module ────────────────────────────────
const P1_NODES: PipelineNode[] = [
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

const P1_EDGES: PipelineEdge[] = [
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

// ─── Sample Pipeline 2: Data Cleaning ─────────────────────────────────────────
const P2_NODES: PipelineNode[] = [
  {
    id: "p2-input-1",
    type: "input",
    position: { x: 80, y: 200 },
    data: {
      label: "原始数据",
      nodeType: "input",
      contextDescription: "CSV 格式的原始用户行为数据，可能含空值和格式错误",
      exampleValue: "user_events_2025.csv",
    },
  },
  {
    id: "p2-skill-1",
    type: "skill",
    position: { x: 350, y: 200 },
    data: {
      label: "数据清洗",
      nodeType: "skill",
      skillName: "data-cleaning",
      params: '{ "dropNulls": true, "normalizeTypes": true }',
      acceptanceCriteria: "无空值行，字段类型统一",
      status: "idle",
    },
  },
  {
    id: "p2-skill-2",
    type: "skill",
    position: { x: 620, y: 200 },
    data: {
      label: "格式转换",
      nodeType: "skill",
      skillName: "format-converter",
      params: '{ "outputFormat": "parquet" }',
      acceptanceCriteria: "输出为 Parquet 格式，压缩率 > 60%",
      status: "idle",
    },
  },
  {
    id: "p2-output-1",
    type: "output",
    position: { x: 880, y: 200 },
    data: {
      label: "清洗结果",
      nodeType: "output",
      expectedSchema: "{ file: string, rowCount: number, columns: string[] }",
      notes: "可直接用于 BI 分析的干净数据集",
    },
  },
];

const P2_EDGES: PipelineEdge[] = [
  {
    id: "p2-e1",
    source: "p2-input-1",
    target: "p2-skill-1",
    data: { label: "原始数据", dataType: "stream" },
    type: "smoothstep",
    animated: true,
  },
  {
    id: "p2-e2",
    source: "p2-skill-1",
    target: "p2-skill-2",
    data: { label: "净化数据", dataType: "data" },
    type: "smoothstep",
    animated: true,
  },
  {
    id: "p2-e3",
    source: "p2-skill-2",
    target: "p2-output-1",
    data: { label: "转换结果", dataType: "artifact" },
    type: "smoothstep",
    animated: false,
  },
];

// ─── Sample Pipeline 3: Order API Generation ──────────────────────────────────
const P3_NODES: PipelineNode[] = [
  {
    id: "p3-input-1",
    type: "input",
    position: { x: 80, y: 220 },
    data: {
      label: "Schema 定义",
      nodeType: "input",
      contextDescription:
        "Drizzle ORM schema 文件，包含 orders 和 orderItems 表",
      exampleValue: "schema/orders.ts",
    },
  },
  {
    id: "p3-skill-1",
    type: "skill",
    position: { x: 350, y: 120 },
    data: {
      label: "生成 Service",
      nodeType: "skill",
      skillName: "service-best-practice",
      params: '{ "entity": "order", "includeRelations": true }',
      acceptanceCriteria: "Service 方法覆盖 CRUD 及关联查询",
      status: "idle",
    },
  },
  {
    id: "p3-skill-2",
    type: "skill",
    position: { x: 350, y: 340 },
    data: {
      label: "生成 tRPC 路由",
      nodeType: "skill",
      skillName: "check-refine-trpc",
      params: '{ "resource": "orders", "auth": true }',
      acceptanceCriteria: "Router 包含 list/get/create/update/delete 过程",
      status: "idle",
    },
  },
  {
    id: "p3-condition-1",
    type: "condition",
    position: { x: 640, y: 220 },
    data: {
      label: "类型检查",
      nodeType: "condition",
      expression: "tsc --noEmit exit 0",
      expectedResult: "无 TypeScript 错误",
      status: "idle",
    },
  },
  {
    id: "p3-output-1",
    type: "output",
    position: { x: 900, y: 220 },
    data: {
      label: "API 产出",
      nodeType: "output",
      expectedSchema: "{ service: string, router: string, types: string }",
      notes: "已类型检查的完整订单 API 层",
    },
  },
];

const P3_EDGES: PipelineEdge[] = [
  {
    id: "p3-e1",
    source: "p3-input-1",
    target: "p3-skill-1",
    data: { label: "Schema", dataType: "context" },
    type: "smoothstep",
    animated: true,
  },
  {
    id: "p3-e2",
    source: "p3-input-1",
    target: "p3-skill-2",
    data: { label: "Schema", dataType: "context" },
    type: "smoothstep",
    animated: true,
  },
  {
    id: "p3-e3",
    source: "p3-skill-1",
    target: "p3-condition-1",
    data: { label: "Service 产出", dataType: "artifact" },
    type: "smoothstep",
    animated: false,
  },
  {
    id: "p3-e4",
    source: "p3-skill-2",
    target: "p3-condition-1",
    data: { label: "Router 产出", dataType: "artifact" },
    type: "smoothstep",
    animated: false,
  },
  {
    id: "p3-e5",
    source: "p3-condition-1",
    target: "p3-output-1",
    data: { label: "检查通过", dataType: "result" },
    type: "smoothstep",
    animated: false,
  },
];

// ─── Store ────────────────────────────────────────────────────────────────────
const INITIAL_PIPELINES: Pipeline[] = [
  {
    id: "pipeline-1",
    name: "用户管理模块开发",
    description:
      "从需求输入出发，依次生成页面结构、DAO 层，经验收检查后产出完整模块。",
    tags: ["page", "dao", "drizzle"],
    nodeCount: P1_NODES.length,
    createdAt: Date.now() - 86400000 * 3,
    updatedAt: Date.now() - 3600000,
    nodes: P1_NODES,
    edges: P1_EDGES,
  },
  {
    id: "pipeline-2",
    name: "数据清洗与格式转换",
    description: "将原始 CSV 数据清洗后转换为 Parquet 格式，供 BI 系统使用。",
    tags: ["data", "etl", "csv"],
    nodeCount: P2_NODES.length,
    createdAt: Date.now() - 86400000 * 7,
    updatedAt: Date.now() - 86400000,
    nodes: P2_NODES,
    edges: P2_EDGES,
  },
  {
    id: "pipeline-3",
    name: "订单 API 层生成",
    description:
      "基于 Drizzle Schema 自动生成 Service + tRPC Router，经类型检查后输出完整 API 层。",
    tags: ["trpc", "service", "orders"],
    nodeCount: P3_NODES.length,
    createdAt: Date.now() - 86400000 * 14,
    updatedAt: Date.now() - 86400000 * 2,
    nodes: P3_NODES,
    edges: P3_EDGES,
  },
];

interface PipelinesState {
  pipelines: Pipeline[];
  activePipelineId: string | null;
  setActivePipelineId: (id: string | null) => void;
  addPipeline: (pipeline: Pipeline) => void;
  updatePipelineGraph: (
    id: string,
    nodes: PipelineNode[],
    edges: PipelineEdge[],
  ) => void;
}

export const usePipelinesStore = create<PipelinesState>()((set) => ({
  pipelines: INITIAL_PIPELINES,
  activePipelineId: null,
  setActivePipelineId: (id) => set({ activePipelineId: id }),
  addPipeline: (pipeline) =>
    set((s) => ({ pipelines: [...s.pipelines, pipeline] })),
  updatePipelineGraph: (id, nodes, edges) =>
    set((s) => ({
      pipelines: s.pipelines.map((p) =>
        p.id === id
          ? {
              ...p,
              nodes,
              edges,
              updatedAt: Date.now(),
              nodeCount: nodes.length,
            }
          : p,
      ),
    })),
}));
