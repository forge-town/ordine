import { Hono } from "hono";
import { ResultAsync } from "neverthrow";
import type { AgentRuntime } from "@repo/schemas";
import { operationsService, operationRunnerService } from "../services.js";

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
  if (!operation) return c.json({ error: "Operation not found" }, 404);

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
  if (!existing) return c.json({ error: "Operation not found" }, 404);
  await operationsService.delete(id);

  return c.body(null, 204);
});

operationsRoutes.post("/:id/run", async (c) => {
  const id = c.req.param("id");

  const parseResult = await ResultAsync.fromPromise(
    c.req.json() as Promise<Record<string, unknown>>,
    () => undefined,
  );
  const body = parseResult.unwrapOr({} as Record<string, unknown>);

  const inputPath = body.inputPath as string | undefined;
  const inputContent = body.inputContent as string | undefined;
  const agentOverride = body.agentOverride as string | undefined;

  const result = await operationRunnerService.startRun({
    operationId: id,
    inputPath,
    inputContent,
    agentOverride: agentOverride as AgentRuntime | undefined,
  });

  if (result.isErr()) {
    return c.json({ error: result.error.message }, 404);
  }

  return c.json({ jobId: result.value.jobId }, 202);
});
