import { z } from "zod/v4";
import { ConversationAttachmentSchema } from "../conversation/ConversationMessageMetadataSchema";

/**
 * proposeActions 请求体里的附件（N14-01）：在持久化附件元数据之上携带
 * 文本类附件的全文。全文只走请求 payload 参与分析，绝不写入
 * conversation_messages（DB 只存 ConversationAttachment 的 excerpt）。
 */
export const ProposeAttachmentSchema = ConversationAttachmentSchema.extend({
  content: z.string().optional(),
});
export type ProposeAttachment = z.infer<typeof ProposeAttachmentSchema>;
