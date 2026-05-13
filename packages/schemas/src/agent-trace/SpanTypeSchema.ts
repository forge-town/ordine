import { z } from "zod/v4";

export const SPAN_TYPE_ENUM = {
  AGENT_RUN: "agent_run",
  LLM_CALL: "llm_call",
  TOOL_CALL: "tool_call",
  TOOL_RESULT: "tool_result",
} as const;
export const SpanTypeSchema = z.enum(SPAN_TYPE_ENUM);
export type SpanType = z.infer<typeof SpanTypeSchema>;
