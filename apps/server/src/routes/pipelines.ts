import { Hono } from "hono";
import { ResultAsync } from "neverthrow";
import { z } from "zod/v4";
import {
  PipelineGraphSnapshotSchema,
  ProposeAttachmentSchema,
  ProposePendingOperationSchema,
} from "@repo/schemas";
import { pipelinesService, pipelineRunnerService } from "../services.js";

export const pipelinesRoutes = new Hono();

const isOperationValidationError = (error: Error): error is Error & { issues: unknown[] } =>
  error.name === "CapabilityCatalogValidationError" ||
  error.name === "OperationConfigValidationError";

const proposeActionsBodySchema = z.object({
  attachments: z.array(ProposeAttachmentSchema).optional(),
  diagnostics: z.array(z.string()).optional(),
  failedProposal: z.unknown().optional(),
  snapshot: PipelineGraphSnapshotSchema,
  message: z.string().trim().min(1),
  pipelineName: z.string().optional(),
  referencedNodeIds: z.array(z.string()).optional(),
  runtimeId: z.string().optional(),
});

const generateStructureBodySchema = z
  .object({
    name: z.string(),
    description: z.string(),
    matchedOperations: z
      .array(
        z
          .object({
            operationId: z.string().min(1),
            operationName: z.string().min(1),
            reason: z.string(),
          })
          .strict(),
      )
      .optional(),
    unmatchedSteps: z
      .array(
        z
          .object({
            step: z.string().min(1),
            reason: z.string(),
          })
          .strict(),
      )
      .optional(),
    runtimeId: z.string().min(1).optional(),
    model: z.string().min(1).optional(),
  })
  .strict();

const runPipelineBodySchema = z.object({
  inputPath: z.string().optional(),
  githubToken: z.string().optional(),
  inputs: z.record(z.string(), z.string()).optional(),
  runtimeConfigId: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
  reasoningEffort: z.string().min(1).optional(),
  speed: z.string().min(1).optional(),
});

pipelinesRoutes.get("/", async (c) => {
  const pipelines = await pipelinesService.getAll();

  return c.json(pipelines);
});

pipelinesRoutes.post("/", async (c) => {
  const body = await c.req.json();
  const { pendingOperations, ...pipelineData } = body;
  const parsedPendingOperations = z
    .array(ProposePendingOperationSchema)
    .optional()
    .safeParse(pendingOperations);
  if (!parsedPendingOperations.success) {
    return c.json(
      {
        error: "Invalid pending operations",
        issues: parsedPendingOperations.error.issues,
      },
      422,
    );
  }
  if (parsedPendingOperations.data && parsedPendingOperations.data.length > 0) {
    const result = await pipelinesService.createWithPendingOperations(
      pipelineData,
      parsedPendingOperations.data,
    );
    if (result.isErr()) {
      return isOperationValidationError(result.error)
        ? c.json({ error: result.error.message, issues: result.error.issues }, 422)
        : c.json({ error: "Failed to create pipeline" }, 500);
    }

    return c.json(result.value, 201);
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
    attachments: parsed.data.attachments,
    diagnostics: parsed.data.diagnostics,
    failedProposal: parsed.data.failedProposal,
    snapshot: parsed.data.snapshot,
    message: parsed.data.message,
    pipelineName: parsed.data.pipelineName,
    referencedNodeIds: parsed.data.referencedNodeIds,
    runtimeId: parsed.data.runtimeId,
  });

  return c.json(result);
});

pipelinesRoutes.post("/:id/run", async (c) => {
  const id = c.req.param("id");
  const pipeline = await pipelinesService.getById(id);
  if (!pipeline) return c.json({ error: "Pipeline not found" }, 404);

  const bodyResult = await ResultAsync.fromPromise(
    c.req.json() as Promise<unknown>,
    () => undefined,
  );
  const parsed = runPipelineBodySchema.safeParse(bodyResult.unwrapOr({}));
  if (!parsed.success) {
    return c.json({ error: "Invalid request body", issues: parsed.error.issues }, 400);
  }

  const result = await pipelineRunnerService.startRun({
    pipelineId: id,
    inputPath: parsed.data.inputPath,
    githubToken: parsed.data.githubToken,
    inputs: parsed.data.inputs,
    runtimeConfigId: parsed.data.runtimeConfigId,
    model: parsed.data.model,
    reasoningEffort: parsed.data.reasoningEffort,
    speed: parsed.data.speed,
  });

  if (result.isErr()) {
    const runtimeMissing =
      (result.error as Error & { code?: string }).code === "AGENT_RUNTIME_NOT_FOUND";

    return c.json(
      {
        code: runtimeMissing ? "AGENT_RUNTIME_NOT_FOUND" : "PIPELINE_NOT_FOUND",
        error: result.error.message,
      },
      runtimeMissing ? 409 : 404,
    );
  }

  return c.json({ jobId: result.value.jobId }, 202);
});

pipelinesRoutes.post("/generate-structure", async (c) => {
  const bodyResult = await ResultAsync.fromPromise(
    c.req.json() as Promise<unknown>,
    () => undefined,
  );
  const parsed = generateStructureBodySchema.safeParse(bodyResult.unwrapOr(undefined));
  if (!parsed.success) {
    return c.json({ error: "Invalid request body", issues: parsed.error.issues }, 400);
  }

  const result = await pipelinesService.generateStructure({
    name: parsed.data.name,
    description: parsed.data.description,
    matchedOperations: parsed.data.matchedOperations,
    unmatchedSteps: parsed.data.unmatchedSteps,
    runtimeId: parsed.data.runtimeId,
    model: parsed.data.model,
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
