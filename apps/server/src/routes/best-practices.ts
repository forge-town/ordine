import { Hono } from "hono";
import {
  bestPracticesService,
  bestPracticesBulkService,
} from "../services.js";
import { BestPracticeImportSchema } from "@repo/schemas";
import { z } from "zod/v4";

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

bestPracticesRoutes.get("/export", async () => {
  const zipData = await bestPracticesBulkService.exportAsZip();

  return new Response(Buffer.from(zipData), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="best-practices-${new Date().toISOString().slice(0, 10)}.bestpractice"`,
    },
  });
});

bestPracticesRoutes.post("/import", async (c) => {
  const parsed = BestPracticeImportSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: z.prettifyError(parsed.error) }, 400);
  }

  const counts = await bestPracticesBulkService.importBulk(parsed.data);

  return c.json(counts);
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
