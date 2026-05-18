import { z } from "zod/v4";
import { DistillationCompletedResultSchema } from "./DistillationCompletedResultSchema";
import { DistillationFailedResultSchema } from "./DistillationFailedResultSchema";

export const DistillationResultSchema = z.union([
  DistillationCompletedResultSchema,
  DistillationFailedResultSchema,
]);
export type DistillationResult = z.infer<typeof DistillationResultSchema>;
