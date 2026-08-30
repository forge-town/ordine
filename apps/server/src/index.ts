import { serve } from "@hono/node-server";
import { ResultAsync } from "neverthrow";
import { app } from "./app.js";
import { agentControlService, agentRunsService, jobsService } from "./services.js";

import { getEnv } from "./integrations/env";

const env = getEnv();
const port = env.PORT ?? 9433;
const hostname = env.DESKTOP_MODE ? "127.0.0.1" : "0.0.0.0";

// JOB_TIMEOUT_MS remains a backwards-compatible fallback for deployments that
// configured the old absolute-runtime sweep. It now applies only to unclaimed
// queues and lease-less jobs left behind by versions before COD-352.
const LEGACY_JOB_TIMEOUT_MS = env.JOB_TIMEOUT_MS ?? 60 * 60 * 1000;
const JOB_QUEUE_TIMEOUT_MS = env.JOB_QUEUE_TIMEOUT_MS ?? LEGACY_JOB_TIMEOUT_MS;
const JOB_LEGACY_STALE_TIMEOUT_MS = env.JOB_LEGACY_STALE_TIMEOUT_MS ?? LEGACY_JOB_TIMEOUT_MS;
const EXPIRE_CHECK_INTERVAL_MS = 60_000;
const jobSweeperId = `server:${crypto.randomUUID()}`;

const interruptedRuns = await agentRunsService.recoverInterruptedRuns();
for (const runId of interruptedRuns.runIds) {
  await agentControlService.rollbackDraftsForRun(runId, "failed");
}
if (interruptedRuns.count > 0) {
  console.log(
    `[agent-runs] Marked ${interruptedRuns.count} unfinished run(s) as interrupted and rolled back control drafts`,
  );
}

const sweepState = { running: false };
const runJobExpirySweep = async (): Promise<void> => {
  const observedAt = new Date();
  const result = await ResultAsync.fromPromise(
    jobsService.expireStaleJobs({
      observedAt,
      queuedTimeoutMs: JOB_QUEUE_TIMEOUT_MS,
      legacyNoLeaseTimeoutMs: JOB_LEGACY_STALE_TIMEOUT_MS,
      sweeperId: jobSweeperId,
    }),
    (cause) => (cause instanceof Error ? cause : new Error(String(cause))),
  );
  sweepState.running = false;
  if (result.isErr()) {
    console.error("[job-expiry] Sweep failed:", result.error);

    return;
  }
  if (result.value.length > 0) {
    console.log(
      `[job-expiry] Expired ${result.value.length} stale job(s):`,
      result.value.map(({ id, expiryContext }) => ({
        id,
        reason: expiryContext?.reason,
        previousStatus: expiryContext?.previousStatus,
      })),
    );
  }
};

const scheduleJobExpirySweep = () => {
  if (sweepState.running) return;

  sweepState.running = true;
  void runJobExpirySweep();
};

scheduleJobExpirySweep();
globalThis.setInterval(scheduleJobExpirySweep, EXPIRE_CHECK_INTERVAL_MS);

globalThis.setInterval(
  async () => {
    const deleted = await agentRunsService.deleteExpired();
    if (deleted > 0) console.log(`[agent-runs] Deleted ${deleted} expired run(s)`);
  },
  24 * 60 * 60 * 1000,
);

serve({ fetch: app.fetch, port, hostname }, (info) => {
  console.log(`Server running at http://${hostname}:${info.port}`);
});
