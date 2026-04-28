import { z } from "zod/v4";
import { JobResultSchema } from "./JobResultSchema";
import { MetaSchema } from "./meta";

export const PipelineRunSchema = z.object({
  id: z.string(),
  pipelineId: z.string().nullable(),
  projectId: z.string().nullable(),
  inputPath: z.string().nullable(),
  logs: z.array(z.string()),
  result: JobResultSchema.nullable(),
  tmuxSessionName: z.string().nullable(),
  meta: MetaSchema.optional(),
});
export type PipelineRun = z.infer<typeof PipelineRunSchema>;
