import { z } from "zod/v4";

export const PipelineAgentSessionStatusSchema = z.enum([
  "draft",
  "analyzing",
  "awaiting_user",
  "proposal_ready",
  "approved",
  "generating",
  "completed",
  "failed",
]);
export type PipelineAgentSessionStatus = z.infer<typeof PipelineAgentSessionStatusSchema>;
