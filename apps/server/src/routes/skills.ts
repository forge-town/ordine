import { Hono } from "hono";
import { skillsService } from "../services.js";

export const skillsRoutes = new Hono();

skillsRoutes.get("/", async (c) => {
  const skills = await skillsService.getAll();
  return c.json(skills);
});

skillsRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const skill = await skillsService.getById(id);
  if (!skill) return c.json({ error: "Not found" }, 404);
  return c.json(skill);
});
