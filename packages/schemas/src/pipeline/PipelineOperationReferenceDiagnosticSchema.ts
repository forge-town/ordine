import { z } from "zod/v4";

export const MissingPipelineOperationSchema = z.object({
  nodeId: z.string().min(1),
  operationId: z.string().min(1),
});
export type MissingPipelineOperation = z.infer<typeof MissingPipelineOperationSchema>;

export const PipelineOperationReferenceDiagnosticSchema = z.object({
  code: z.literal("PIPELINE_OPERATION_MISSING"),
  pipelineId: z.string().min(1),
  missingOperations: z.array(MissingPipelineOperationSchema).min(1),
});
export type PipelineOperationReferenceDiagnostic = z.infer<
  typeof PipelineOperationReferenceDiagnosticSchema
>;
