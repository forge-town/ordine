import { z } from "zod/v4";
import { LogLevelSchema } from "./LogLevelSchema";

export const JobTraceSchema = z.object({
  id: z.number(),
  jobId: z.string(),
  level: LogLevelSchema,
  message: z.string(),
  createdAt: z.coerce.date(),
});
export type JobTrace = z.infer<typeof JobTraceSchema>;
