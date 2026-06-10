import { z } from "zod/v4";

export const ConversationAttachmentSchema = z.object({
  name: z.string(),
  path: z.string(),
  type: z.string(),
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
  proposalSnapshot: ConversationProposalSnapshotSchema.optional(),
  errorContext: ConversationErrorContextSchema.optional(),
  tokenUsage: ConversationTokenUsageSchema.optional(),
});
export type ConversationMessageMetadata = z.infer<typeof ConversationMessageMetadataSchema>;
