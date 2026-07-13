import { z } from "zod/v4";

export const JOB_TRIGGERED_BY_ENUM = {
  MANUAL: "manual",
  ROUTINE: "routine",
  AGENT: "agent",
} as const;
export const JobTriggeredBySchema = z.enum(JOB_TRIGGERED_BY_ENUM);
export type JobTriggeredBy = z.infer<typeof JobTriggeredBySchema>;
