import { z } from "zod/v4";

export const RecipeSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().default(""),
  operationId: z.string(),
  bestPracticeId: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Recipe = z.infer<typeof RecipeSchema>;
