import { z } from "zod/v4";
import { ClaudeContentBlockSchema } from "./ClaudeContentBlockSchema";
import { ClaudeMessageUsageSchema } from "./ClaudeMessageUsageSchema";

export const ClaudeMessageSchema = z.object({
  content: z.array(ClaudeContentBlockSchema).optional(),
  model: z.string().optional(),
  usage: ClaudeMessageUsageSchema.optional(),
  stop_reason: z.string().nullable().optional(),
});

export type ClaudeMessage = z.infer<typeof ClaudeMessageSchema>;
