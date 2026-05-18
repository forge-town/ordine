import { z } from "zod/v4";

export const JobResultSchema = z.object({
  output: z.string().optional(),
  summary: z.string().optional(),
});
export type JobResult = z.infer<typeof JobResultSchema>;
