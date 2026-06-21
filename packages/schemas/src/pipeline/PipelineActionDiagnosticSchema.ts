import { z } from "zod/v4";

export const PIPELINE_ACTION_DIAGNOSTIC_CODES = {
  CHILD_NODE_NOT_SUPPORTED: "CHILD_NODE_NOT_SUPPORTED",
  COMPOUND_NODE_NOT_SUPPORTED: "COMPOUND_NODE_NOT_SUPPORTED",
  DUPLICATE_EDGE_ID: "DUPLICATE_EDGE_ID",
  DUPLICATE_NODE_ID: "DUPLICATE_NODE_ID",
  EDGE_NOT_FOUND: "EDGE_NOT_FOUND",
  INVALID_CONNECTION: "INVALID_CONNECTION",
  INVALID_NODE_DATA: "INVALID_NODE_DATA",
  NODE_NOT_FOUND: "NODE_NOT_FOUND",
} as const;

export const PipelineActionDiagnosticCodeSchema = z.enum(
  PIPELINE_ACTION_DIAGNOSTIC_CODES,
);
export type PipelineActionDiagnosticCode = z.infer<
  typeof PipelineActionDiagnosticCodeSchema
>;

export const PipelineActionDiagnosticSeveritySchema = z.enum(["error", "warning"]);
export type PipelineActionDiagnosticSeverity = z.infer<
  typeof PipelineActionDiagnosticSeveritySchema
>;

export const PipelineActionDiagnosticSchema = z.object({
  code: PipelineActionDiagnosticCodeSchema,
  severity: PipelineActionDiagnosticSeveritySchema.default("error"),
  message: z.string(),
  actionIndex: z.number().int().nonnegative().nullable().optional(),
});
export type PipelineActionDiagnostic = z.infer<typeof PipelineActionDiagnosticSchema>;
