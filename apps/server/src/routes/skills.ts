import { Hono } from "hono";
import { skillsService, skillsDao } from "../services.js";

export const skillsRoutes = new Hono();

skillsRoutes.get("/", async (c) => {
  await skillsDao.seedIfEmpty();
  const skills = await skillsService.getAll();

  return c.json(skills);
});

skillsRoutes.post("/", async (c) => {
  const body = await c.req.json();
  const skill = await skillsService.create(body);

  return c.json(skill, 201);
});

skillsRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const skill = await skillsService.getById(id);
  if (!skill)
 return c.json({ error: "Skill not found" }, 404);

  return c.json(skill);
});

skillsRoutes.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const skill = await skillsService.update(id, body);

  return c.json(skill);
});

skillsRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const existing = await skillsService.getById(id);
  if (!existing)
 return c.json({ error: "Skill not found" }, 404);
  await skillsService.delete(id);

  return c.body(null, 204);
});
