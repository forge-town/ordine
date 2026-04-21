import { Hono } from "hono";
import { recipesService } from "../services.js";

export const recipesRoutes = new Hono();

recipesRoutes.get("/", async (c) => {
  const recipes = await recipesService.getAll();

  return c.json(recipes);
});

recipesRoutes.post("/", async (c) => {
  const body = await c.req.json();
  const recipe = await recipesService.create(body);

  return c.json(recipe, 201);
});

recipesRoutes.put("/", async (c) => {
  const body = await c.req.json();
  const existing = await recipesService.getById(body.id);
  if (existing) {
    const { id: _, ...patch } = body;
    const updated = await recipesService.update(body.id, patch);

    return c.json(updated);
  }
  const recipe = await recipesService.create(body);

  return c.json(recipe, 201);
});

recipesRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const existing = await recipesService.getById(id);
  if (!existing) return c.json({ error: "Recipe not found" }, 404);
  await recipesService.delete(id);

  return c.body(null, 204);
});
