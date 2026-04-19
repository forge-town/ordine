import { z } from "zod/v4";
import { ClaudeMessageSchema } from "./ClaudeMessageSchema";
import { ClaudeModelUsageSchema } from "./ClaudeModelUsageSchema";

export const ClaudeStreamEventSchema = z.object({
  type: z.string(),
  subtype: z.string().optional(),
  message: ClaudeMessageSchema.optional(),
  duration_ms: z.number().optional(),
  total_cost_usd: z.number().optional(),
  modelUsage: z.record(z.string(), ClaudeModelUsageSchema).optional(),
  content: z.unknown().optional(),
  tool_use_id: z.string().nullable().optional(),
  parent_tool_use_id: z.string().nullable().optional(),
  /** Present on `type: "result"` events — final text output from the model */
  result: z.string().optional(),
  /** Present on `type: "result"` events — number of agentic turns taken */
  num_turns: z.number().optional(),
});

export type ClaudeStreamEvent = z.infer<typeof ClaudeStreamEventSchema>;
