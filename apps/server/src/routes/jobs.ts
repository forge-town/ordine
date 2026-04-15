import { Hono } from "hono";
import type { JobStatus } from "@repo/db-schema";
import { jobsService } from "../services.js";

export const jobsRoutes = new Hono();

jobsRoutes.get("/", async (c) => {
  const status = c.req.query("status") as JobStatus | undefined;
  const workId = c.req.query("workId");
  const projectId = c.req.query("projectId");

  const filter: { status?: JobStatus; workId?: string; projectId?: string } = {};
  if (status) filter.status = status;
  if (workId) filter.workId = workId;
  if (projectId) filter.projectId = projectId;

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
