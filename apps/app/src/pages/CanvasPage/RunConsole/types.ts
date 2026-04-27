export type JobStatus = "queued" | "running" | "done" | "failed" | "cancelled" | "expired";

export interface JobData {
  id: string;
  status: JobStatus;
  error: string | null;
  startedAt: number | null;
  finishedAt: number | null;
}
