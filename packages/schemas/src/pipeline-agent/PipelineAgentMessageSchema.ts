import { z } from "zod/v4";
import { AgentContextEnvelopeSchema } from "../agent-control/AgentControlSchema";

export const PipelineAgentMessageRoleSchema = z.enum(["user", "assistant", "system"]);
export type PipelineAgentMessageRole = z.infer<typeof PipelineAgentMessageRoleSchema>;

export const PipelineAgentMessageKindSchema = z.enum([
  "text",
  "question",
  "answer",
  "proposal_summary",
  "generation_result",
  "phase",
  "progress",
]);
export type PipelineAgentMessageKind = z.infer<typeof PipelineAgentMessageKindSchema>;

export const PipelineAgentMessageSchema = z.object({
  id: z.string().min(1),
  sessionId: z.string().min(1),
  role: PipelineAgentMessageRoleSchema,
  kind: PipelineAgentMessageKindSchema,
  content: z.string(),
  context: AgentContextEnvelopeSchema.nullable().default(null),
  runId: z.string().min(1).nullable().default(null),
  createdAt: z.date(),
});
export type PipelineAgentMessage = z.infer<typeof PipelineAgentMessageSchema>;
