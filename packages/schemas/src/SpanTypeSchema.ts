import { z } from "zod/v4";

export const SpanTypeSchema = z.enum(["agent_run", "llm_call", "tool_call", "tool_result"]);
export type SpanType = z.infer<typeof SpanTypeSchema>;
