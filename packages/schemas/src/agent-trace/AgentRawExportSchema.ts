import { z } from "zod/v4";
import { AgentRuntimeSchema } from "../agent-runtime/AgentRuntimeSchema";
import { AgentRunStatusSchema } from "../agent-runtime/AgentRunStatusSchema";

export const AgentRawExportSchema = z.object({
  id: z.number(),
  jobId: z.string(),
  agentRuntime: AgentRuntimeSchema,
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
