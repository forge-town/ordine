import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { z } from "zod";
import { createTool } from "@mastra/core/tools";

const validatePipelineTool = createTool({
  id: "validate-pipeline",
  description: "验证 Ordine Pipeline 的结构完整性：节点连接、验收条件、数据流",
  inputSchema: z.object({
    nodes: z.array(
      z.object({
        id: z.string(),
        type: z.enum(["input", "skill", "condition", "output"]),
        label: z.string(),
        skillName: z.string().optional(),
        acceptanceCriteria: z.string().optional(),
        expression: z.string().optional(),
      }),
    ),
    edges: z.array(
      z.object({
        id: z.string(),
        source: z.string(),
        target: z.string(),
        dataType: z.string().optional(),
      }),
    ),
  }),
  execute: async (context) => {
    const { nodes, edges } = context;
    const issues: string[] = [];
    const suggestions: string[] = [];

    const connectedIds = new Set<string>();
    edges.forEach((e) => {
      connectedIds.add(e.source);
      connectedIds.add(e.target);
    });

    nodes.forEach((node) => {
      if (!connectedIds.has(node.id)) {
        issues.push(`节点 "${node.label}" (${node.id}) 未连接任何边`);
      }
      if (node.type === "skill" && !node.acceptanceCriteria) {
        suggestions.push(`Skill 节点 "${node.label}" 缺少验收条件，建议补充`);
      }
      if (node.type === "skill" && !node.skillName) {
        issues.push(`Skill 节点 "${node.label}" 未指定 skillName`);
      }
      if (node.type === "condition" && !node.expression) {
        issues.push(`验收条件节点 "${node.label}" 未填写条件表达式`);
      }
    });

    const inputCount = nodes.filter((n) => n.type === "input").length;
    const outputCount = nodes.filter((n) => n.type === "output").length;
    if (inputCount === 0) issues.push("Pipeline 缺少输入节点");
    if (outputCount === 0) issues.push("Pipeline 缺少输出节点");

    edges.forEach((e) => {
      if (!e.dataType) {
        suggestions.push(`边 ${e.source} → ${e.target} 建议标注数据类型`);
      }
    });

    return {
      isValid: issues.length === 0,
      issueCount: issues.length,
      issues,
      suggestions,
      summary: `检查了 ${nodes.length} 个节点和 ${edges.length} 条边。发现 ${issues.length} 个问题，${suggestions.length} 条建议。`,
    };
  },
});

export const pipelineValidatorAgent = new Agent({
  id: "pipeline-validator-agent",
  name: "Pipeline 验证器",
  instructions: `
你是 Ordine 平台的 Pipeline 结构验证工具。当用户请求验证时，使用 validate-pipeline 工具进行检查，
然后以结构化的方式汇报结果。优先指出阻断性问题（issues），再给出改进建议（suggestions）。用中文回复，格式清晰。
  `,
  model: "gpt-4o-mini",
  tools: {
    validatePipeline: validatePipelineTool,
  },
  memory: new Memory({
    options: {
      lastMessages: 10,
    },
  }),
});

const validateConnectionsTool = createTool({
  id: "validate-connections",
  description: "验证线束设计中的连接关系完整性",
  inputSchema: z.object({
    nodes: z.array(
      z.object({
        id: z.string(),
        type: z.string(),
        label: z.string(),
        pinCount: z.number().optional(),
      }),
    ),
    edges: z.array(
      z.object({
        id: z.string(),
        source: z.string(),
        target: z.string(),
        netName: z.string().optional(),
        wireGauge: z.string().optional(),
      }),
    ),
  }),
  execute: async (context) => {
    const { nodes, edges } = context;
    const issues: string[] = [];
    const suggestions: string[] = [];

    // Check for isolated nodes (no connections)
    const connectedNodeIds = new Set<string>();
    edges.forEach((e) => {
      connectedNodeIds.add(e.source);
      connectedNodeIds.add(e.target);
    });

    nodes.forEach((node) => {
      if (!connectedNodeIds.has(node.id)) {
        issues.push(`元件 "${node.label}" (${node.id}) 未连接任何导线`);
      }
    });

    // Check for edges without net names
    edges.forEach((edge) => {
      if (!edge.netName) {
        issues.push(`连接 ${edge.source} → ${edge.target} 缺少网络名称`);
      }
      if (!edge.wireGauge) {
        suggestions.push(
          `连接 ${edge.source} → ${edge.target} 建议指定导线截面积`,
        );
      }
    });

    return {
      isValid: issues.length === 0,
      issueCount: issues.length,
      issues,
      suggestions,
      summary: `检查了 ${nodes.length} 个元件和 ${edges.length} 条导线。发现 ${issues.length} 个问题，${suggestions.length} 条建议。`,
    };
  },
});

export const harnessValidatorAgent = new Agent({
  id: "harness-validator-agent",
  name: "线束设计验证器",
  instructions: `
你是一个线束设计自动验证工具。当用户请求验证时，使用 validate-connections 工具进行检查，
然后以结构化的方式汇报结果。用中文回复，格式清晰。
  `,
  model: "gpt-4o-mini",
  tools: {
    validateConnections: validateConnectionsTool,
  },
  memory: new Memory({
    options: {
      lastMessages: 10,
    },
  }),
});
