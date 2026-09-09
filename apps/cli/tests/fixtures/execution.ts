import { ExecutionJobSchema, ExecutionEventSchema } from "@repo/schemas";

export const job = ExecutionJobSchema.parse({
  apiVersion: 2,
  id: "job-1",
  preparedRunId: "prepared-1",
  revision: 1,
  state: "succeeded",
  createdAt: "2026-09-08T12:00:00Z",
  startedAt: "2026-09-08T12:00:00Z",
  finishedAt: "2026-09-08T12:01:00Z",
  deadlineAt: null,
  waitingDeadlineAt: null,
  stopReason: null,
  error: null,
  warnings: [],
});
export const event = ExecutionEventSchema.parse({
  sequence: 8,
  jobId: job.id,
  nodeId: null,
  attemptId: null,
  type: "job_completed",
  payload: {},
  createdAt: "2026-09-08T12:01:00Z",
});
