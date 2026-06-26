import { z } from "zod/v4";

export const PipelineAgentContextArtifactKindSchema = z.enum([
  "image_summary",
  "text_extract",
  "document_extract",
  "structured_summary",
]);
export type PipelineAgentContextArtifactKind = z.infer<
  typeof PipelineAgentContextArtifactKindSchema
>;

export const PipelineAgentContextArtifactContentSchema = z.object({
  text: z.string().optional(),
  summary: z.string().optional(),
  mediaType: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type PipelineAgentContextArtifactContent = z.infer<
  typeof PipelineAgentContextArtifactContentSchema
>;

export const PipelineAgentContextArtifactSchema = z.object({
  id: z.string().min(1),
  sessionId: z.string().min(1),
  attachmentId: z.string().nullable(),
  kind: PipelineAgentContextArtifactKindSchema,
  content: PipelineAgentContextArtifactContentSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type PipelineAgentContextArtifact = z.infer<typeof PipelineAgentContextArtifactSchema>;
