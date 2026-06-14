import { z } from "zod/v4";
import { ConversationMessageMetadataSchema } from "./ConversationMessageMetadataSchema";
import { ConversationRoleSchema } from "./ConversationRoleSchema";

export const ConversationMessageSchema = z.object({
  id: z.string(),
  pipelineId: z.string(),
  role: ConversationRoleSchema,
  content: z.string(),
  metadata: ConversationMessageMetadataSchema.nullable(),
  phase: z.string().nullable(),
  createdAt: z.coerce.date(),
});
export type ConversationMessage = z.infer<typeof ConversationMessageSchema>;

export const CreateConversationMessageSchema = ConversationMessageSchema.omit({
  id: true,
  createdAt: true,
}).extend({
  metadata: ConversationMessageMetadataSchema.nullable().optional(),
  phase: z.string().nullable().optional(),
});
export type CreateConversationMessageInput = z.infer<typeof CreateConversationMessageSchema>;

export const UpdateConversationMessageSchema = CreateConversationMessageSchema.partial();
export type UpdateConversationMessageInput = z.infer<typeof UpdateConversationMessageSchema>;
