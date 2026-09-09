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
import { executionAuthoringRoutes } from "./routes/executionAuthoring";
import { productMetadataRoutes } from "./routes/productMetadataRoutes";

const env = getEnv();

export const app = new Hono();

app.use("*", logger());
// Authoring/history remain available; only the v2 service may execute Pipelines.
app.use("/api/*", async (c, next) => {
  if (
    (c.req.method === "POST" &&
      /^\/api\/(?:(?:pipelines|operations)\/[^/]+\/run|routines\/[^/]+\/run-now|jobs(?:\/[^/]+\/(?:pause|resume|cancel))?)\/?$/u.test(
        c.req.path,
      )) ||
    (c.req.method === "PATCH" && /^\/api\/jobs\/[^/]+\/?$/u.test(c.req.path))
  )
    return c.json({ error: "旧运行接口已停用，请使用 v2 运行请求。" }, 410);

  return next();
});

if (env.DESKTOP_MODE) {
  app.use(
    "*",
    cors({
      origin: env.ORDINE_DESKTOP_ALLOWED_ORIGINS ?? [
        "http://tauri.localhost",
        "tauri://localhost",
        "http://localhost:9431",
      ],
    }),
  );
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
  app.use("*", async (c, next) => {
    if (
      c.req.path === "/health" ||
      /^\/api\/internal\/agent-runs\/[0-9a-f-]{36}\/mcp$/iu.test(c.req.path)
    )
      return next();
    if (
      !env.ORDINE_AGENT_API_TOKEN ||
      c.req.header("Authorization") !== `Bearer ${env.ORDINE_AGENT_API_TOKEN}`
    )
      return c.json({ error: "Unauthorized" }, 401);

    return next();
  });
}

app.route("/api/agents", agentsRoutes);
app.route("/api/execution", executionAuthoringRoutes);
app.route("/api/agent-runs", agentRunsRoutes);
app.route("/api/agent-runtimes", agentRuntimesRoutes);
app.route("/api", productMetadataRoutes);
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
