import { z } from "zod/v4";

export const ClaudeContentBlockSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("thinking"),
    thinking: z.string(),
  }),
  z.object({
    type: z.literal("text"),
    text: z.string(),
  }),
  z.object({
    type: z.literal("tool_use"),
    id: z.string(),
    name: z.string(),
    input: z.unknown(),
  }),
  z.object({
    type: z.literal("tool_result"),
    tool_use_id: z.string().optional(),
    text: z.string().optional(),
  }),
]);

export type ClaudeContentBlock = z.infer<typeof ClaudeContentBlockSchema>;
