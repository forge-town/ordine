import type { createJobsDao } from "@repo/models";

const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 600;

export const waitForJobCompletion = async (
  jobsDao: ReturnType<typeof createJobsDao>,
  jobId: string,
): Promise<{ status: string; error?: string }> => {
  for (const _ of Array.from({ length: MAX_POLL_ATTEMPTS })) {
    const job = await jobsDao.findById(jobId);
    if (!job) return { status: "failed", error: "Job not found" };

    if (job.status === "done") return { status: "completed" };
    if (job.status === "failed") return { status: "failed", error: job.error ?? "Job failed" };

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  return { status: "failed", error: "Job timed out" };
};
