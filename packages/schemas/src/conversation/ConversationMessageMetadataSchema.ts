import { z } from "zod/v4";
import { ProposeActionsErrorCodeSchema } from "../pipeline/ProposeActionsResponseSchema";

export const ConversationAttachmentSchema = z.object({
  name: z.string(),
  path: z.string().optional(),
  type: z.string().optional(),
  /** 字节数（N14-01）。旧消息无此字段，保持 optional 兼容。 */
  size: z.number().int().min(0).optional(),
  /** 文本附件前 1k 摘录——DB 只存 excerpt，全文走请求 payload 不落库（手册警告 6）。 */
  excerpt: z.string().optional(),
});
export type ConversationAttachment = z.infer<typeof ConversationAttachmentSchema>;

export const ConversationProposalSnapshotSchema = z.object({
  addedNodes: z.array(z.string()).default([]),
  addedEdges: z.array(z.string()).default([]),
});
export type ConversationProposalSnapshot = z.infer<typeof ConversationProposalSnapshotSchema>;

export const ConversationErrorContextSchema = z.object({
  nodeId: z.string(),
  what: z.string(),
  why: z.string(),
  try: z.string(),
});
export type ConversationErrorContext = z.infer<typeof ConversationErrorContextSchema>;

export const ConversationTokenUsageSchema = z.object({
  input: z.number(),
  output: z.number(),
  cost: z.number(),
});
export type ConversationTokenUsage = z.infer<typeof ConversationTokenUsageSchema>;

export const ConversationMessageMetadataSchema = z.object({
  referencedNodeIds: z.array(z.string()).optional(),
  attachments: z.array(ConversationAttachmentSchema).optional(),
  clarifyOptions: z.array(z.string()).optional(),
  diagnostics: z.array(z.string()).optional(),
  proposeErrorCode: ProposeActionsErrorCodeSchema.optional(),
  proposalSnapshot: ConversationProposalSnapshotSchema.optional(),
  errorContext: ConversationErrorContextSchema.optional(),
  tokenUsage: ConversationTokenUsageSchema.optional(),
  resolved: z.boolean().optional(),
});
export type ConversationMessageMetadata = z.infer<typeof ConversationMessageMetadataSchema>;
