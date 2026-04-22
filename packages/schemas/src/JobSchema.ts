import { z } from "zod/v4";
import { JobStatusSchema } from "./JobStatusSchema";
import { JobTypeSchema } from "./JobTypeSchema";
import { JobResultSchema } from "./JobResultSchema";
import { MetaSchema } from "./meta";

export const JobSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: JobTypeSchema,
  status: JobStatusSchema,
  projectId: z.string().nullable(),
  pipelineId: z.string().nullable(),
  logs: z.array(z.string()),
  result: JobResultSchema.nullable(),
  tmuxSessionName: z.string().nullable(),
  error: z.string().nullable(),
  startedAt: z.coerce.date().nullable(),
  finishedAt: z.coerce.date().nullable(),
  meta: MetaSchema,
});
export type Job = z.infer<typeof JobSchema>;
