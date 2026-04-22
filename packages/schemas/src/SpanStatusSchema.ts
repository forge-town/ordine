import { z } from "zod/v4";

export const SpanStatusSchema = z.enum(["running", "completed", "error"]);
export type SpanStatus = z.infer<typeof SpanStatusSchema>;
