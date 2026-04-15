import { Hono } from "hono";
import { worksService } from "../services.js";

export const worksRoutes = new Hono();

worksRoutes.get("/", async (c) => {
  const projectId = c.req.query("projectId");
  const works = projectId
    ? await worksService.getByProject(projectId)
    : await worksService.getAll();
  return c.json(works);
});

worksRoutes.post("/", async (c) => {
  const body = await c.req.json();
  const work = await worksService.create({
    ...body,
    status: "pending",
    logs: [],
  });
  return c.json(work, 201);
});

worksRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const work = await worksService.getById(id);
  if (!work) return c.json({ error: "Work not found" }, 404);
  return c.json(work);
});

worksRoutes.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const work = await worksService.updateStatus(id, body.status);
  return c.json(work);
});

worksRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const existing = await worksService.getById(id);
  if (!existing) return c.json({ error: "Work not found" }, 404);
  await worksService.delete(id);
  return c.body(null, 204);
});
