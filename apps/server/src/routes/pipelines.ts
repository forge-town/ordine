import { Hono } from "hono";
import { ResultAsync } from "neverthrow";
import { z } from "zod/v4";
import { PipelineGraphSnapshotSchema } from "@repo/schemas";
import { pipelinesService, pipelineRunnerService } from "../services.js";

export const pipelinesRoutes = new Hono();

const proposeActionsBodySchema = z.object({
  snapshot: PipelineGraphSnapshotSchema,
  message: z.string().trim().min(1),
  pipelineName: z.string().optional(),
  runtimeId: z.string().optional(),
});

pipelinesRoutes.get("/", async (c) => {
  const pipelines = await pipelinesService.getAll();

  return c.json(pipelines);
});

pipelinesRoutes.post("/", async (c) => {
  const body = await c.req.json();
  const { pendingOperations, ...pipelineData } = body;
  if (Array.isArray(pendingOperations) && pendingOperations.length > 0) {
    await pipelinesService.createPendingOperations(pendingOperations);
  }
  const pipeline = await pipelinesService.create(pipelineData);

  return c.json(pipeline, 201);
});

pipelinesRoutes.put("/", async (c) => {
  const body = await c.req.json();
  const existing = await pipelinesService.getById(body.id);
  if (existing) {
    const { id: _, ...patch } = body;
    const updated = await pipelinesService.update(body.id, patch);

    return c.json(updated);
  }
  const pipeline = await pipelinesService.create(body);

  return c.json(pipeline, 201);
});

pipelinesRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const pipeline = await pipelinesService.getById(id);
  if (!pipeline) return c.json({ error: "Pipeline not found" }, 404);

  return c.json(pipeline);
});

pipelinesRoutes.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const pipeline = await pipelinesService.update(id, body);

  return c.json(pipeline);
});

pipelinesRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const existing = await pipelinesService.getById(id);
  if (!existing) return c.json({ error: "Pipeline not found" }, 404);
  await pipelinesService.delete(id);

  return c.body(null, 204);
});

pipelinesRoutes.post("/:id/propose-actions", async (c) => {
  const id = c.req.param("id");
  const bodyResult = await ResultAsync.fromPromise(
    c.req.json() as Promise<unknown>,
    () => undefined,
  );
  const body = bodyResult.unwrapOr(undefined);
  const parsed = proposeActionsBodySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid request body" }, 400);
  }

  const result = await pipelinesService.proposeActions({
    pipelineId: id,
    snapshot: parsed.data.snapshot,
    message: parsed.data.message,
    pipelineName: parsed.data.pipelineName,
    runtimeId: parsed.data.runtimeId,
  });

  return c.json(result);
});

pipelinesRoutes.post("/:id/run", async (c) => {
  const id = c.req.param("id");
  const pipeline = await pipelinesService.getById(id);
  if (!pipeline) return c.json({ error: "Pipeline not found" }, 404);

  const bodyResult = await ResultAsync.fromPromise(
    c.req.json() as Promise<Record<string, unknown>>,
    () => undefined,
  );
  const body = bodyResult.unwrapOr({});
  const inputPath = (body as Record<string, unknown>).inputPath as string | undefined;
  const githubToken = (body as Record<string, unknown>).githubToken as string | undefined;
  const inputs = (body as Record<string, unknown>).inputs as Record<string, string> | undefined;

  const result = await pipelineRunnerService.startRun({
    pipelineId: id,
    inputPath,
    githubToken,
    inputs,
  });

  if (result.isErr()) {
    return c.json({ error: result.error.message }, 404);
  }

  return c.json({ jobId: result.value.jobId }, 202);
});

pipelinesRoutes.post("/generate-structure", async (c) => {
  const body = (await c.req.json()) as {
    name: string;
    description: string;
    matchedOperations?: Array<{ operationId: string; operationName: string; reason: string }>;
    unmatchedSteps?: Array<{ step: string; reason: string }>;
  };
  const result = await pipelinesService.generateStructure({
    name: body.name ?? "",
    description: body.description ?? "",
    matchedOperations: body.matchedOperations,
    unmatchedSteps: body.unmatchedSteps,
  });

  if ("error" in result) {
    return c.json({ error: result.error }, 500);
  }

  return c.json(result);
});

pipelinesRoutes.post("/analyze-intent", async (c) => {
  const body = (await c.req.json()) as { name: string; description: string };
  const result = await pipelinesService.analyzeIntent({
    name: body.name ?? "",
    description: body.description ?? "",
  });

  return c.json(result);
});
