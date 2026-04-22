import { z } from "zod/v4";
import { SpanTypeSchema } from "./SpanTypeSchema";
import { SpanStatusSchema } from "./SpanStatusSchema";

export const AgentSpanSchema = z.object({
  id: z.number(),
  jobId: z.string(),
  rawExportId: z.number().nullable(),
  parentSpanId: z.number().nullable(),
  spanType: SpanTypeSchema,
  name: z.string(),
  input: z.string().nullable(),
  output: z.string().nullable(),
  modelId: z.string().nullable(),
  tokenInput: z.number().nullable(),
  tokenOutput: z.number().nullable(),
  durationMs: z.number().nullable(),
  status: SpanStatusSchema,
  error: z.string().nullable(),
  metadata: z.unknown().nullable(),
  startedAt: z.coerce.date(),
  finishedAt: z.coerce.date().nullable(),
});
export type AgentSpan = z.infer<typeof AgentSpanSchema>;
