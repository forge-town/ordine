import { Hono } from "hono";
import type { JobStatus, JobType } from "@repo/db-schema";
import { jobsService } from "../services.js";

export const jobsRoutes = new Hono();

jobsRoutes.get("/", async (c) => {
  const status = c.req.query("status") as JobStatus | undefined;
  const type = c.req.query("type") as JobType | undefined;
  const parentJobId = c.req.query("parentJobId");

  const filter: { status?: JobStatus; type?: JobType; parentJobId?: string } = {};
  if (status) filter.status = status;
  if (type) filter.type = type;
  if (parentJobId) filter.parentJobId = parentJobId;

  const jobs = await jobsService.getAll(filter);

  return c.json(jobs);
});

jobsRoutes.post("/", async (c) => {
  const body = await c.req.json();
  const job = await jobsService.create(body);

  return c.json(job, 201);
});

jobsRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const job = await jobsService.getById(id);
  if (!job) return c.json({ error: "Job not found" }, 404);

  return c.json(job);
});

jobsRoutes.get("/:id/traces", async (c) => {
  const id = c.req.param("id");
  const traces = await jobsService.getTracesByJobId(id);

  return c.json(traces);
});

jobsRoutes.get("/:id/agent-runs", async (c) => {
  const id = c.req.param("id");
  const runs = await jobsService.getAgentRunsByJobId(id);

  return c.json(runs);
});

jobsRoutes.get("/:id/agent-runs/:runId/spans", async (c) => {
  const rawExportId = Number(c.req.param("runId"));
  if (Number.isNaN(rawExportId)) return c.json({ error: "Invalid runId" }, 400);
  const spans = await jobsService.getSpansByRawExportId(rawExportId);

  return c.json(spans);
});

jobsRoutes.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const { status: jobStatus, ...extra } = body;
  const job = await jobsService.updateStatus(id, jobStatus, extra);
  if (!job) return c.json({ error: "Job not found" }, 404);

  return c.json(job);
});

jobsRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const existing = await jobsService.getById(id);
  if (!existing) return c.json({ error: "Job not found" }, 404);
  await jobsService.delete(id);

  return c.body(null, 204);
});
