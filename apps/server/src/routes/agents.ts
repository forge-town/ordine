import { Hono } from "hono";
import { agentsService } from "../services.js";

export const agentsRoutes = new Hono();

agentsRoutes.get("/", async (c) => {
  const agents = await agentsService.getAll();

  return c.json(agents);
});

agentsRoutes.post("/", async (c) => {
  const body = await c.req.json();
  const agent = await agentsService.create(body);

  return c.json(agent, 201);
});

agentsRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const agent = await agentsService.getById(id);
  if (!agent) return c.json({ error: "Agent not found" }, 404);

  return c.json(agent);
});

agentsRoutes.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const agent = await agentsService.update(id, body);

  return c.json(agent);
});

agentsRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const existing = await agentsService.getById(id);
  if (!existing) return c.json({ error: "Agent not found" }, 404);
  await agentsService.delete(id);

  return c.body(null, 204);
});
