import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { bestPracticesRoutes } from "./routes/best-practices.js";
import { checklistItemsRoutes } from "./routes/checklist-items.js";
import { codeSnippetsRoutes } from "./routes/code-snippets.js";
import { filesystemRoutes } from "./routes/filesystem.js";
import { jobsRoutes } from "./routes/jobs.js";
import { operationsRoutes } from "./routes/operations.js";
import { pipelinesRoutes } from "./routes/pipelines.js";
import { recipesRoutes } from "./routes/recipes.js";
import { rulesRoutes } from "./routes/rules.js";
import { skillsRoutes } from "./routes/skills.js";

export const app = new Hono();

app.use("*", logger());
app.use("*", cors());

app.route("/api/best-practices", bestPracticesRoutes);
app.route("/api/checklist-items", checklistItemsRoutes);
app.route("/api/code-snippets", codeSnippetsRoutes);
app.route("/api/filesystem", filesystemRoutes);
app.route("/api/jobs", jobsRoutes);
app.route("/api/operations", operationsRoutes);
app.route("/api/pipelines", pipelinesRoutes);
app.route("/api/recipes", recipesRoutes);
app.route("/api/rules", rulesRoutes);
app.route("/api/skills", skillsRoutes);

app.get("/health", (c) => c.json({ status: "ok" }));
