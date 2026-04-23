import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { bestPracticesRoutes } from "./routes/best-practices";
import { checklistItemsRoutes } from "./routes/checklist-items";
import { codeSnippetsRoutes } from "./routes/code-snippets";
import { distillationsRoutes } from "./routes/distillations";
import { filesystemRoutes } from "./routes/filesystem";
import { jobsRoutes } from "./routes/jobs";
import { operationsRoutes } from "./routes/operations";
import { pipelinesRoutes } from "./routes/pipelines";
import { recipesRoutes } from "./routes/recipes";
import { rulesRoutes } from "./routes/rules";
import { skillsRoutes } from "./routes/skills";

export const app = new Hono();

app.use("*", logger());
app.use("*", cors());

app.route("/api/best-practices", bestPracticesRoutes);
app.route("/api/checklist-items", checklistItemsRoutes);
app.route("/api/code-snippets", codeSnippetsRoutes);
app.route("/api/distillations", distillationsRoutes);
app.route("/api/filesystem", filesystemRoutes);
app.route("/api/jobs", jobsRoutes);
app.route("/api/operations", operationsRoutes);
app.route("/api/pipelines", pipelinesRoutes);
app.route("/api/recipes", recipesRoutes);
app.route("/api/rules", rulesRoutes);
app.route("/api/skills", skillsRoutes);

app.get("/health", (c) => c.json({ status: "ok" }));
