import { z } from "zod/v4";
import { AgentSystemSchema, AgentRunStatusSchema } from "./AgentSystemSchema";

export const AgentRawExportSchema = z.object({
  id: z.number(),
  jobId: z.string(),
  agentSystem: AgentSystemSchema,
  agentId: z.string(),
  modelId: z.string().nullable(),
  rawPayload: z.unknown(),
  tokenInput: z.number().nullable(),
  tokenOutput: z.number().nullable(),
  durationMs: z.number().nullable(),
  status: AgentRunStatusSchema,
  createdAt: z.coerce.date(),
});
export type AgentRawExport = z.infer<typeof AgentRawExportSchema>;
