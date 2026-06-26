import { z } from "zod/v4";
import { PipelineGraphSnapshotSchema } from "../pipeline/PipelineGraphSnapshotSchema";
import { PipelineAgentEntrypointSchema } from "./PipelineAgentEntrypointSchema";
import { PipelineAgentModeSchema } from "./PipelineAgentModeSchema";
import { PipelineAgentSessionStatusSchema } from "./PipelineAgentSessionStatusSchema";

export const PipelineAgentSessionSchema = z.object({
  id: z.string().min(1),
  entrypoint: PipelineAgentEntrypointSchema,
  mode: PipelineAgentModeSchema,
  status: PipelineAgentSessionStatusSchema,
  pipelineId: z.string().nullable(),
  snapshot: PipelineGraphSnapshotSchema.nullable(),
  latestProposalId: z.string().nullable(),
  approvedProposalId: z.string().nullable(),
  createdPipelineId: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type PipelineAgentSession = z.infer<typeof PipelineAgentSessionSchema>;
