import { z } from "zod/v4";

export const PipelineAgentAttachmentSourceTypeSchema = z.enum(["upload"]);
export type PipelineAgentAttachmentSourceType = z.infer<
  typeof PipelineAgentAttachmentSourceTypeSchema
>;

export const PipelineAgentAttachmentParseStatusSchema = z.enum(["pending", "parsed", "failed"]);
export type PipelineAgentAttachmentParseStatus = z.infer<
  typeof PipelineAgentAttachmentParseStatusSchema
>;

export const PipelineAgentAttachmentSchema = z.object({
  id: z.string().min(1),
  sessionId: z.string().min(1),
  filename: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().nonnegative(),
  sourceType: PipelineAgentAttachmentSourceTypeSchema,
  storageKey: z.string().min(1),
  parseStatus: PipelineAgentAttachmentParseStatusSchema,
  parseError: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type PipelineAgentAttachment = z.infer<typeof PipelineAgentAttachmentSchema>;
