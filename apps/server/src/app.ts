import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { agentsRoutes } from "./routes/agents";
import { distillationsRoutes } from "./routes/distillations";
import { filesystemRoutes } from "./routes/filesystem";
import { jobsRoutes } from "./routes/jobs";
import { operationsRoutes } from "./routes/operations";
import { pipelinesRoutes } from "./routes/pipelines";
import { skillsRoutes } from "./routes/skills";
import { getEnv } from "./integrations/env";

const env = getEnv();

export const app = new Hono();

app.use("*", logger());

if (env.DESKTOP_MODE) {
  app.use("*", cors({ origin: "http://localhost" }));
  app.use("*", async (c, next) => {
    // Health endpoint doesn't require auth (used for startup probe)
    if (c.req.path === "/health") {
      return next();
    }
    const token = c.req.header("X-Desktop-Token");
    if (!env.DESKTOP_AUTH_TOKEN || token !== env.DESKTOP_AUTH_TOKEN) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    return next();
  });
} else {
  app.use("*", cors());
}

app.route("/api/agents", agentsRoutes);
app.route("/api/distillations", distillationsRoutes);
app.route("/api/filesystem", filesystemRoutes);
app.route("/api/jobs", jobsRoutes);
app.route("/api/operations", operationsRoutes);
app.route("/api/pipelines", pipelinesRoutes);
app.route("/api/skills", skillsRoutes);

app.get("/health", (c) => c.json({ status: "ok" }));
