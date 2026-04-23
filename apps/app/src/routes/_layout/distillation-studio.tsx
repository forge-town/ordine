import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod/v4";
import { DistillationModeSchema, DistillationSourceTypeSchema } from "@repo/schemas";
import { DistillationStudioPage } from "@/pages/DistillationStudioPage";

export const distillationStudioSearchSchema = z.object({
  distillationId: z.string().optional(),
  sourceType: DistillationSourceTypeSchema.optional(),
  sourceId: z.string().optional(),
  sourceLabel: z.string().optional(),
  mode: DistillationModeSchema.optional(),
});

export const Route = createFileRoute("/_layout/distillation-studio")({
  validateSearch: distillationStudioSearchSchema,
  component: DistillationStudioPage,
});
