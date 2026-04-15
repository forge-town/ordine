import { Hono } from "hono";
import { checklistService } from "../services.js";

export const checklistItemsRoutes = new Hono();

checklistItemsRoutes.get("/", async (c) => {
  const bestPracticeId = c.req.query("bestPracticeId");
  if (!bestPracticeId) {
    return c.json({ error: "bestPracticeId query param is required" }, 400);
  }
  const items = await checklistService.getItemsByBestPracticeId(bestPracticeId);
  return c.json(items);
});

checklistItemsRoutes.put("/", async (c) => {
  const body = await c.req.json();
  const existing = await checklistService.getItemById(body.id);
  if (existing) {
    const { id: _, bestPracticeId: __, ...patch } = body;
    const updated = await checklistService.updateItem(body.id, patch);
    return c.json(updated);
  }
  const item = await checklistService.createItem(body);
  return c.json(item, 201);
});

checklistItemsRoutes.delete("/", async (c) => {
  const id = c.req.query("id");
  if (!id) {
    return c.json({ error: "id query param is required" }, 400);
  }
  await checklistService.deleteItem(id);
  return c.json({ deleted: id });
});
