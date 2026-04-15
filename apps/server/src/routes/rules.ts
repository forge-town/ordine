import { Hono } from "hono";
import type { RuleCategory } from "@repo/db-schema";
import { rulesService } from "../services.js";

export const rulesRoutes = new Hono();

rulesRoutes.get("/", async (c) => {
  const categoryParam = c.req.query("category") as RuleCategory | undefined;
  const enabledParam = c.req.query("enabled");
  const enabled = enabledParam === "true" ? true : enabledParam === "false" ? false : undefined;

  const filter: { category?: RuleCategory; enabled?: boolean } = {};
  if (categoryParam) filter.category = categoryParam;
  if (enabled !== undefined) filter.enabled = enabled;

  const rules = await rulesService.getAll(filter);
  return c.json(rules);
});

rulesRoutes.post("/", async (c) => {
  const body = await c.req.json();
  const rule = await rulesService.create(body);
  return c.json(rule, 201);
});

rulesRoutes.put("/", async (c) => {
  const body = await c.req.json();
  const existing = await rulesService.getById(body.id);
  if (existing) {
    const { id: _, ...patch } = body;
    const updated = await rulesService.update(body.id, patch);
    return c.json(updated);
  }
  const rule = await rulesService.create(body);
  return c.json(rule, 201);
});

rulesRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const rule = await rulesService.getById(id);
  if (!rule) return c.json({ error: "Rule not found" }, 404);
  return c.json(rule);
});

rulesRoutes.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const rule = await rulesService.update(id, body);
  return c.json(rule);
});

rulesRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const existing = await rulesService.getById(id);
  if (!existing) return c.json({ error: "Rule not found" }, 404);
  await rulesService.delete(id);
  return c.body(null, 204);
});
