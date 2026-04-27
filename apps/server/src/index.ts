import { serve } from "@hono/node-server";
import { app } from "./app.js";
import { jobsService } from "./services.js";

import { getEnv } from "./integrations/env";

const env = getEnv();
const port = env.PORT ?? 9433;

const DEFAULT_JOB_TIMEOUT_MS = env.JOB_TIMEOUT_MS ?? 15 * 60 * 1000; // 15 min
const EXPIRE_CHECK_INTERVAL_MS = 60_000; // every 60s

setInterval(async () => {
  const expired = await jobsService.expireStaleJobs(DEFAULT_JOB_TIMEOUT_MS);
  if (expired.length > 0) {
    console.log(
      `[job-expiry] Expired ${expired.length} stale job(s):`,
      expired.map((r) => r.id),
    );
  }
}, EXPIRE_CHECK_INTERVAL_MS);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Server running at http://localhost:${info.port}`);
});
