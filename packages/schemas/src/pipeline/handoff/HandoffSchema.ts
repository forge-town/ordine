import { z } from "zod/v4";
import { ConcreteMediaTypeSchema } from "../../operation/MediaTypeSchema";

/** A real file written during a node run. File bytes stay in storage; this is its receipt. */
export const HandoffFileSchema = z.object({
  fileId: z.string().min(1),
  fileName: z.string().min(1),
  relativePath: z.string().min(1),
  storageUri: z.string().min(1),
  mediaType: ConcreteMediaTypeSchema,
  sizeBytes: z.number().int().nonnegative(),
  sha256: z
    .string()
    .regex(/^[a-f0-9]{64}$/i)
    .optional(),
});
export type HandoffFile = z.infer<typeof HandoffFileSchema>;

/** The actual files produced by one operation output port in one pipeline run. */
export const HandoffSchema = z.object({
  handoffId: z.string().min(1),
  pipelineRunId: z.string().min(1),
  producer: z.object({
    nodeId: z.string().min(1),
    nodeRunId: z.string().min(1),
    operationId: z.string().min(1),
    outputPortId: z.string().min(1),
  }),
  sourceFileIds: z.array(z.string()).default([]),
  files: z.array(HandoffFileSchema).min(1),
});
export type Handoff = z.infer<typeof HandoffSchema>;

/** Runtime file IO grouped by the operation port that consumed or produced it. */
export const NodeFileIOResultSchema = z.object({
  ports: z.record(z.string(), z.array(HandoffSchema)),
});
export type NodeFileIOResult = z.infer<typeof NodeFileIOResultSchema>;
