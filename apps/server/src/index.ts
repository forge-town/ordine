import { serve } from "@hono/node-server";
import { app } from "./app.js";
import { agentRunsService, jobsService } from "./services.js";

import { getEnv } from "./integrations/env";

const env = getEnv();
const port = env.PORT ?? 9433;
const hostname = env.DESKTOP_MODE ? "127.0.0.1" : "0.0.0.0";

const DEFAULT_JOB_TIMEOUT_MS = env.JOB_TIMEOUT_MS ?? 60 * 60 * 1000; // 60 min
const EXPIRE_CHECK_INTERVAL_MS = 60_000; // every 60s

const interruptedRuns = await agentRunsService.recoverInterruptedRuns();
if (interruptedRuns > 0) {
  console.log(`[agent-runs] Marked ${interruptedRuns} unfinished run(s) as interrupted`);
}

setInterval(async () => {
  const expired = await jobsService.expireStaleJobs(DEFAULT_JOB_TIMEOUT_MS);
  if (expired.length > 0) {
    console.log(
      `[job-expiry] Expired ${expired.length} stale job(s):`,
      expired.map((r: { id: string }) => r.id),
    );
  }
}, EXPIRE_CHECK_INTERVAL_MS);

setInterval(
  async () => {
    const deleted = await agentRunsService.deleteExpired();
    if (deleted > 0) console.log(`[agent-runs] Deleted ${deleted} expired run(s)`);
  },
  24 * 60 * 60 * 1000,
);

serve({ fetch: app.fetch, port, hostname }, (info) => {
  console.log(`Server running at http://${hostname}:${info.port}`);
});
