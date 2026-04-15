import { Hono } from "hono";
import { bestPracticesService, checklistService, codeSnippetsService } from "../services.js";

export const bestPracticesRoutes = new Hono();

bestPracticesRoutes.get("/", async (c) => {
  const practices = await bestPracticesService.getAll();
  return c.json(practices);
});

bestPracticesRoutes.post("/", async (c) => {
  const body = await c.req.json();
  const practice = await bestPracticesService.create(body);
  return c.json(practice, 201);
});

bestPracticesRoutes.put("/", async (c) => {
  const body = await c.req.json();
  const existing = await bestPracticesService.getById(body.id);
  if (existing) {
    const { id: _, ...patch } = body;
    const updated = await bestPracticesService.update(body.id, patch);
    return c.json(updated);
  }
  const practice = await bestPracticesService.create(body);
  return c.json(practice, 201);
});

bestPracticesRoutes.get("/export", async (c) => {
  const practices = await bestPracticesService.getAll();
  const result = await Promise.all(
    practices.map(async (bp) => {
      const [items, snippets] = await Promise.all([
        checklistService.getItemsByBestPracticeId(bp.id),
        codeSnippetsService.getByBestPracticeId(bp.id),
      ]);
      return {
        ...bp,
        checklistItems: items.map((item) => ({
          id: item.id,
          title: item.title,
          description: item.description,
          checkType: item.checkType,
          script: item.script,
          sortOrder: item.sortOrder,
        })),
        codeSnippets: snippets.map((s) => ({
          id: s.id,
          title: s.title,
          language: s.language,
          code: s.code,
          sortOrder: s.sortOrder,
        })),
      };
    }),
  );
  return c.json(result);
});

bestPracticesRoutes.post("/import", async (c) => {
  const entries = await c.req.json();
  const counts = { bp: 0, cl: 0, cs: 0 };

  for (const entry of entries) {
    const { checklistItems = [], codeSnippets = [], ...bpData } = entry;

    const existing = await bestPracticesService.getById(bpData.id);
    if (existing) {
      const { id: _, ...patch } = bpData;
      await bestPracticesService.update(bpData.id, patch);
    } else {
      await bestPracticesService.create(bpData);
    }
    counts.bp++;

    for (const item of checklistItems) {
      const itemData = { ...item, bestPracticeId: bpData.id };
      const existingItem = await checklistService.getItemById(item.id);
      if (existingItem) {
        const { id: _, bestPracticeId: __, ...patch } = itemData;
        await checklistService.updateItem(item.id, patch);
      } else {
        await checklistService.createItem(itemData);
      }
      counts.cl++;
    }

    for (const snippet of codeSnippets) {
      const snippetData = { ...snippet, bestPracticeId: bpData.id };
      const existingSnippet = await codeSnippetsService.getById(snippet.id);
      if (existingSnippet) {
        const { id: _, bestPracticeId: __, ...patch } = snippetData;
        await codeSnippetsService.update(snippet.id, patch);
      } else {
        await codeSnippetsService.create(snippetData);
      }
      counts.cs++;
    }
  }

  return c.json({ imported: counts.bp, checklistItems: counts.cl, codeSnippets: counts.cs });
});

bestPracticesRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const practice = await bestPracticesService.getById(id);
  if (!practice) return c.json({ error: "Best practice not found" }, 404);
  return c.json(practice);
});

bestPracticesRoutes.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const practice = await bestPracticesService.update(id, body);
  return c.json(practice);
});

bestPracticesRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const existing = await bestPracticesService.getById(id);
  if (!existing) return c.json({ error: "Best practice not found" }, 404);
  await bestPracticesService.delete(id);
  return c.body(null, 204);
});
