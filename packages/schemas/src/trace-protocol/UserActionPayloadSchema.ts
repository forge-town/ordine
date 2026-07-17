import { z } from "zod/v4";

/**
 * `@@USER_ACTION::` 标记的 JSON 负载结构。
 * 执行器在缺少用户侧配置时输出，前端解析后渲染可交互卡片。
 * 解析（含坏 JSON 容错）在消费端用 neverthrow 实现，本文件只持有真相 schema。
 */
export const UserActionKindSchema = z.enum(["configure-input", "configure-output", "provide-info"]);
export type UserActionKind = z.infer<typeof UserActionKindSchema>;

export const UserActionPayloadSchema = z.object({
  // 非字符串 field 容错为 undefined（忽略坏字段但仍保留请求），与历史解析语义一致（H 评审 #2）。
  field: z.string().optional().catch(undefined),
  kind: UserActionKindSchema,
  // 非空校验基于 trim 结果，但保留原始 message（不做 trim 变换），与历史解析行为一致。
  message: z.string().refine((value) => value.trim().length > 0),
});
export type UserActionPayload = z.infer<typeof UserActionPayloadSchema>;
