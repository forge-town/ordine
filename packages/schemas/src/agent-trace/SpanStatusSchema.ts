import { z } from "zod/v4";

export const SPAN_STATUS_ENUM = {
  RUNNING: "running",
  COMPLETED: "completed",
  ERROR: "error",
} as const;
export const SpanStatusSchema = z.enum(SPAN_STATUS_ENUM);
export type SpanStatus = z.infer<typeof SpanStatusSchema>;
