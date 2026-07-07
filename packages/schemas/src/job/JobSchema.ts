import { z } from "zod/v4";
import { JobStatusSchema } from "./JobStatusSchema";
import { JobTriggeredBySchema } from "./JobTriggeredBySchema";
import { JobTypeSchema } from "./JobTypeSchema";
import { MetaSchema } from "../meta";
import { NodeRunStatusSchema } from "../pipeline/node-data";

export const JobSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: JobTypeSchema,
  status: JobStatusSchema,
  parentJobId: z.string().nullable(),
  pipelineId: z.string().nullable().optional(),
  projectId: z.string().nullable().optional(),
  totalTokens: z.number().nullable().optional(),
  totalCost: z.union([z.string(), z.number()]).nullable().optional(),
  nodeStatuses: z.record(z.string(), NodeRunStatusSchema).nullable().optional(),
  triggeredBy: JobTriggeredBySchema.optional(),
  error: z.string().nullable(),
  startedAt: z.coerce.date().nullable(),
  finishedAt: z.coerce.date().nullable(),
  meta: MetaSchema.optional(),
});
export type Job = z.infer<typeof JobSchema>;
