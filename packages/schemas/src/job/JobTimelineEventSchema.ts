import { z } from "zod/v4";

export const JobTimelineEventTypeSchema = z.enum(["trace", "agent"]);
export type JobTimelineEventType = z.infer<typeof JobTimelineEventTypeSchema>;

export const JobTimelineEventSchema = z.object({
  key: z.string(),
  type: JobTimelineEventTypeSchema,
  label: z.string(),
  description: z.string(),
  createdAt: z.coerce.date(),
});
export type JobTimelineEvent = z.infer<typeof JobTimelineEventSchema>;
