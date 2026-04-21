import { z } from "zod/v4";
import { ClaudeContentBlockSchema } from "./ClaudeContentBlockSchema";
import { ClaudeMessageUsageSchema } from "./ClaudeMessageUsageSchema";

export const ClaudeMessageSchema = z.object({
  content: z.array(ClaudeContentBlockSchema).optional(),
  model: z.string().optional(),
  usage: ClaudeMessageUsageSchema.optional(),
});

export type ClaudeMessage = z.infer<typeof ClaudeMessageSchema>;
