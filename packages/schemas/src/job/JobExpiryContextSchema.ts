import { z } from "zod/v4";
export const JobExpiryReasonSchema = z.enum([
  "queue_timeout",
  "lease_expired",
  "legacy_no_lease_timeout",
]);
export type JobExpiryReason = z.infer<typeof JobExpiryReasonSchema>;

export const JobExpiryPreviousStatusSchema = z.enum(["queued", "running", "paused"]);

export const JobExpiryContextSchema = z.object({
  reason: JobExpiryReasonSchema,
  previousStatus: JobExpiryPreviousStatusSchema,
  observedAtMs: z.number().int().nonnegative(),
  staleBeforeMs: z.number().int().nonnegative(),
  timeoutMs: z.number().int().positive().nullable(),
  sweeperId: z.string().min(1),
});
export type JobExpiryContext = z.infer<typeof JobExpiryContextSchema>;
