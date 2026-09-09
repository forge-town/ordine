import { Hono } from "hono";
import { z } from "zod/v4";
import { ExecutionOverridesSchema } from "@repo/schemas";
import { canvasExecutionPublisher, operationExecutionPublisher } from "../services";
import { validateJson, validationErrorJson, resultJson } from "./result";

// The product app's existing authenticated authoring boundary owns these routes.
export const executionAuthoringRoutes = new Hono();
executionAuthoringRoutes.post("/publish-canvas", async (c) => {
  const parsed = await validateJson(
    c,
    z.strictObject({
      pipelineId: z.string().min(1),
      executionOverrides: ExecutionOverridesSchema.optional(),
      expectedRevision: z.number().int().nonnegative().optional(),
    }),
  );
  if (!parsed.success) return validationErrorJson(c);

  return resultJson(c, await canvasExecutionPublisher.publish(parsed.data));
});
executionAuthoringRoutes.post("/publish-operation", async (c) => {
  const parsed = await validateJson(c, z.strictObject({ operationId: z.string().min(1) }));
  if (!parsed.success) return validationErrorJson(c);

  return resultJson(c, await operationExecutionPublisher.publish(parsed.data));
});
