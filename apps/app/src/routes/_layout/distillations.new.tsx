import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod/v4";
import {
  DistillationModeSchema,
  DistillationSourceTypeSchema,
} from "@repo/schemas";
import { DistillationStudioPage } from "@/pages/DistillationStudioPage";

export const Route = createFileRoute("/_layout/distillations/new")({
  validateSearch: z.object({
    sourceType: DistillationSourceTypeSchema.optional(),
    sourceId: z.string().optional(),
    sourceLabel: z.string().optional(),
    mode: DistillationModeSchema.optional(),
  }),
  component: DistillationStudioPage,
});
