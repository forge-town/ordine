import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { agentsRoutes } from "./routes/agents";
import { agentRunsRoutes } from "./routes/agentRuns";
import { agentRuntimesRoutes } from "./routes/agentRuntimes";
import { agentControlMcpRoutes, internalAgentControlMcpRoutes } from "./routes/agentControlMcp";
import { agentThreadsRoutes } from "./routes/agentThreads";
import { agentControlApiRoutes } from "./routes/agentControlApi";
import { connectorsRoutes } from "./routes/connectors";
import { conversationsRoutes } from "./routes/conversations";
import { distillationsRoutes } from "./routes/distillations";
import { filesystemRoutes } from "./routes/filesystem";
import { jobsRoutes } from "./routes/jobs";
import { operationsRoutes } from "./routes/operations";
import { pipelineAgentSessionsRoutes } from "./routes/pipelineAgentSessions";
import { pipelineAssetsRoutes } from "./routes/pipeline-assets";
import { pipelinesRoutes } from "./routes/pipelines";
import { projectsRoutes } from "./routes/projects";
import { routinesRoutes } from "./routes/routines";
import { skillsRoutes } from "./routes/skills";
import { usageRoutes } from "./routes/usage";
import { getEnv } from "./integrations/env";

const env = getEnv();

export const app = new Hono();

app.use("*", logger());

if (env.DESKTOP_MODE) {
  app.use("*", cors({ origin: "http://localhost" }));
  app.use("*", async (c, next) => {
    // Health endpoint doesn't require auth (used for startup probe)
    const internalMcpPath = /^\/api\/internal\/agent-runs\/[0-9a-f-]{36}\/mcp$/iu;
    if (c.req.path === "/health" || internalMcpPath.test(c.req.path)) {
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
app.route("/api/agent-runs", agentRunsRoutes);
app.route("/api/agent-runtimes", agentRuntimesRoutes);
app.route("/api/agent-threads", agentThreadsRoutes);
app.route("/api/agent-control", agentControlApiRoutes);
app.route("/api/internal/agent-runs", internalAgentControlMcpRoutes);
app.route("/api/mcp", agentControlMcpRoutes);
app.route("/api/connectors", connectorsRoutes);
app.route("/api/conversations", conversationsRoutes);
app.route("/api/distillations", distillationsRoutes);
app.route("/api/filesystem", filesystemRoutes);
app.route("/api/jobs", jobsRoutes);
app.route("/api/operations", operationsRoutes);
app.route("/api/pipeline-agent-sessions", pipelineAgentSessionsRoutes);
app.route("/api/pipeline-assets", pipelineAssetsRoutes);
app.route("/api/pipelines", pipelinesRoutes);
app.route("/api/projects", projectsRoutes);
app.route("/api/routines", routinesRoutes);
app.route("/api/skills", skillsRoutes);
app.route("/api/usage", usageRoutes);

app.get("/health", (c) => c.json({ status: "ok" }));
