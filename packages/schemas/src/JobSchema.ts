import { z } from "zod/v4";
import { JobStatusSchema } from "./JobStatusSchema";
import { JobTypeSchema } from "./JobTypeSchema";
import { MetaSchema } from "./meta";

export const JobSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: JobTypeSchema,
  status: JobStatusSchema,
  parentJobId: z.string().nullable(),
  error: z.string().nullable(),
  startedAt: z.coerce.date().nullable(),
  finishedAt: z.coerce.date().nullable(),
  meta: MetaSchema.optional(),
});
export type Job = z.infer<typeof JobSchema>;
