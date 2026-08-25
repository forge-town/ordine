import { Hono } from "hono";
import { ResultAsync } from "neverthrow";
import type { AgentRuntime } from "@repo/schemas";
import { operationsService, operationRunnerService } from "../services.js";

export const operationsRoutes = new Hono();

const isOperationValidationError = (error: Error): error is Error & { issues: unknown[] } =>
  error.name === "CapabilityCatalogValidationError" ||
  error.name === "OperationConfigValidationError";

operationsRoutes.get("/", async (c) => {
  const operations = await operationsService.getAll();

  return c.json(operations);
});

operationsRoutes.post("/", async (c) => {
  const body = await c.req.json();
  const result = await operationsService.create(body);
  if (result.isErr()) {
    return isOperationValidationError(result.error)
      ? c.json({ error: result.error.message, issues: result.error.issues }, 422)
      : c.json({ error: "Failed to create operation" }, 500);
  }

  return c.json(result.value, 201);
});

operationsRoutes.put("/", async (c) => {
  const body = await c.req.json();
  const existing = await operationsService.getById(body.id);
  if (existing) {
    const { id: _, ...patch } = body;
    const result = await operationsService.update(body.id, patch);
    if (result.isErr()) {
      return isOperationValidationError(result.error)
        ? c.json({ error: result.error.message, issues: result.error.issues }, 422)
        : c.json({ error: "Failed to update operation" }, 500);
    }

    return c.json(result.value);
  }
  const result = await operationsService.create(body);
  if (result.isErr()) {
    return isOperationValidationError(result.error)
      ? c.json({ error: result.error.message, issues: result.error.issues }, 422)
      : c.json({ error: "Failed to create operation" }, 500);
  }

  return c.json(result.value, 201);
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
  const result = await operationsService.update(id, body);
  if (result.isErr()) {
    return isOperationValidationError(result.error)
      ? c.json({ error: result.error.message, issues: result.error.issues }, 422)
      : c.json({ error: "Failed to update operation" }, 500);
  }

  return c.json(result.value);
});

operationsRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const existing = await operationsService.getById(id);
  if (!existing) return c.json({ error: "Operation not found" }, 404);
  const result = await operationsService.delete(id);
  if (result.isErr()) {
    const error = result.error as Error & {
      code?: string;
      operationId?: string;
      pipelineIds?: string[];
    };
    if (error.code === "OPERATION_IN_USE") {
      return c.json(
        {
          error: error.message,
          code: error.code,
          operationId: error.operationId,
          pipelineIds: error.pipelineIds,
        },
        409,
      );
    }

    return c.json({ error: "Failed to delete operation" }, 500);
  }

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
