import { z } from "zod/v4";

/**
 * Agent 上下文的单一事实源。
 * 该 payload 由前端 `buildAgentContext()` 组装，ContextStrip 渲染的与
 * proposeActions 实际发送的是同一个对象——Strip 所见即 Agent 所得。
 * snapshot 与对话 history 走既有通道（snapshot 字段 / 服务端 DB 窗口），
 * 这里只描述"是否包含"，不重复传内容。
 */

export const AgentContextAnchorSchema = z.object({
  count: z.number().int().min(0),
  label: z.string().optional(),
  refId: z.string(),
});
export type AgentContextAnchor = z.infer<typeof AgentContextAnchorSchema>;

export const AgentContextSelectionSchema = z.object({
  label: z.string().optional(),
  refId: z.string(),
  type: z.enum(["node", "edge"]),
});
export type AgentContextSelection = z.infer<typeof AgentContextSelectionSchema>;

export const AgentContextRunStateSchema = z.object({
  jobId: z.string(),
  /** nodeId → run status（normalize 后的 NodeRunStatus 字符串）。 */
  nodeStatuses: z.record(z.string(), z.string()),
  status: z.string(),
});
export type AgentContextRunState = z.infer<typeof AgentContextRunStateSchema>;

export const AgentContextPayloadSchema = z.object({
  anchors: z.array(AgentContextAnchorSchema),
  /** 跨会话记忆尚未实现——字段先行保留，当前永远缺省、ContextStrip 中不点亮。 */
  memory: z.object({ summary: z.string() }).optional(),
  project: z
    .object({
      pipelineId: z.string(),
      pipelineName: z.string().optional(),
    })
    .optional(),
  runState: AgentContextRunStateSchema.optional(),
  selection: z.array(AgentContextSelectionSchema),
  /** 图快照走既有 snapshot 字段；此处仅声明它随消息发送。 */
  snapshotIncluded: z.boolean(),
  /** 对话历史由服务端按窗口从 DB 注入；enabled=false 表示当前无历史。 */
  threadWindow: z.object({
    enabled: z.boolean(),
    limit: z.number().int().positive(),
  }),
});
export type AgentContextPayload = z.infer<typeof AgentContextPayloadSchema>;
