import { Hono } from "hono";
import { distillationsService } from "../services.js";

export const distillationsRoutes = new Hono();

distillationsRoutes.get("/", async (c) => {
  const distillations = await distillationsService.getAll();

  return c.json(distillations);
});

distillationsRoutes.post("/", async (c) => {
  const body = await c.req.json();
  const distillation = await distillationsService.create(body);

  return c.json(distillation, 201);
});

distillationsRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const distillation = await distillationsService.getById(id);
  if (!distillation) return c.json({ error: "Distillation not found" }, 404);

  return c.json(distillation);
});

distillationsRoutes.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const distillation = await distillationsService.update(id, body);

  return c.json(distillation);
});

distillationsRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const existing = await distillationsService.getById(id);
  if (!existing) return c.json({ error: "Distillation not found" }, 404);
  await distillationsService.delete(id);

  return c.body(null, 204);
});
