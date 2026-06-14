import { z } from "zod/v4";

export const CONVERSATION_ROLE_ENUM = {
  USER: "user",
  AGENT: "agent",
  SYSTEM: "system",
} as const;
export const ConversationRoleSchema = z.enum(CONVERSATION_ROLE_ENUM);
export type ConversationRole = z.infer<typeof ConversationRoleSchema>;
