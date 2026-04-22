import { z } from "zod/v4";

export const JobStatusSchema = z.enum(["queued", "running", "done", "failed", "cancelled"]);
export type JobStatus = z.infer<typeof JobStatusSchema>;
