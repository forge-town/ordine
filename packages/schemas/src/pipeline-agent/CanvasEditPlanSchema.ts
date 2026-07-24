import { z } from "zod/v4";
import { PipelineActionDiagnosticSchema } from "../pipeline/PipelineActionDiagnosticSchema";
import { PipelineActionSchema } from "../pipeline/PipelineActionSchema";
import { ProposePendingOperationSchema } from "../pipeline/ProposeActionsResponseSchema";
import { PipelineAgentPlanReadinessSchema } from "./PipelineGenerationPlanSchema";

export const CanvasEditPlanSchema = z.object({
  mode: z.literal("edit"),
  summary: z.string().min(1),
  targetGraphIntent: z.string().min(1),
  majorChanges: z.array(z.string()).default([]),
  assumptions: z.array(z.string()).default([]),
  openQuestions: z.array(z.string()).default([]),
  actions: z.array(PipelineActionSchema).default([]),
  diagnosticsPreview: z.array(PipelineActionDiagnosticSchema).default([]),
  readiness: PipelineAgentPlanReadinessSchema,
  pendingOperations: z.array(ProposePendingOperationSchema).default([]),
});
export type CanvasEditPlan = z.infer<typeof CanvasEditPlanSchema>;
