import { Hono } from "hono";
import { codeSnippetsService } from "../services.js";

export const codeSnippetsRoutes = new Hono();

codeSnippetsRoutes.get("/", async (c) => {
  const bestPracticeId = c.req.query("bestPracticeId");
  if (!bestPracticeId) {
    return c.json({ error: "bestPracticeId query param is required" }, 400);
  }
  const items = await codeSnippetsService.getByBestPracticeId(bestPracticeId);

  return c.json(items);
});

codeSnippetsRoutes.put("/", async (c) => {
  const body = await c.req.json();
  const existing = await codeSnippetsService.getById(body.id);
  if (existing) {
    const { id: _, bestPracticeId: __, ...patch } = body;
    const updated = await codeSnippetsService.update(body.id, patch);

    return c.json(updated);
  }
  const item = await codeSnippetsService.create(body);

  return c.json(item, 201);
});

codeSnippetsRoutes.delete("/", async (c) => {
  const id = c.req.query("id");
  if (!id) {
    return c.json({ error: "id query param is required" }, 400);
  }
  await codeSnippetsService.delete(id);

  return c.json({ deleted: id });
});
