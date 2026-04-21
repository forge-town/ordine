import { Hono } from "hono";
import { operationsService } from "../services.js";

export const operationsRoutes = new Hono();

operationsRoutes.get("/", async (c) => {
  const operations = await operationsService.getAll();

  return c.json(operations);
});

operationsRoutes.post("/", async (c) => {
  const body = await c.req.json();
  const operation = await operationsService.create(body);

  return c.json(operation, 201);
});

operationsRoutes.put("/", async (c) => {
  const body = await c.req.json();
  const existing = await operationsService.getById(body.id);
  if (existing) {
    const { id: _, ...patch } = body;
    const updated = await operationsService.update(body.id, patch);

    return c.json(updated);
  }
  const operation = await operationsService.create(body);

  return c.json(operation, 201);
});

operationsRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const operation = await operationsService.getById(id);
  if (!operation)
 return c.json({ error: "Operation not found" }, 404);

  return c.json(operation);
});

operationsRoutes.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const operation = await operationsService.update(id, body);

  return c.json(operation);
});

operationsRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const existing = await operationsService.getById(id);
  if (!existing)
 return c.json({ error: "Operation not found" }, 404);
  await operationsService.delete(id);

  return c.body(null, 204);
});
