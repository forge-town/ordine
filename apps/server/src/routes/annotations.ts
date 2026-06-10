import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import { z } from "zod/v4";
import { CreateAnnotationSchema, UpdateAnnotationSchema } from "@repo/schemas";
import { annotationsService } from "../services.js";
import { resultJson, resultNoContent, validateJson, validationErrorJson } from "./result.js";

export const annotationsRoutes = new Hono();

const listQuerySchema = z.object({
  pipelineId: z.string().optional(),
  targetId: z.string().optional(),
});

const CreateAnnotationRouteSchema = CreateAnnotationSchema.extend({
  id: z.string().default(() => randomUUID()),
});

annotationsRoutes.get("/", async (c) => {
  const parsed = listQuerySchema.safeParse({
    pipelineId: c.req.query("pipelineId"),
    targetId: c.req.query("targetId"),
  });
  if (!parsed.success) return validationErrorJson(c);

  const result = parsed.data.pipelineId
    ? await annotationsService.getByPipelineId(parsed.data.pipelineId)
    : parsed.data.targetId
      ? await annotationsService.getByTargetId(parsed.data.targetId)
      : await annotationsService.getAll();

  return resultJson(c, result);
});

annotationsRoutes.post("/", async (c) => {
  const parsed = await validateJson(c, CreateAnnotationRouteSchema);
  if (!parsed.success) return validationErrorJson(c);

  const result = await annotationsService.create(parsed.data);

  return resultJson(c, result, 201);
});

annotationsRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const result = await annotationsService.getById(id);

  return resultJson(c, result);
});

annotationsRoutes.patch("/:id", async (c) => {
  const parsed = await validateJson(c, UpdateAnnotationSchema);
  if (!parsed.success) return validationErrorJson(c);

  const id = c.req.param("id");
  const result = await annotationsService.update(id, parsed.data);

  return resultJson(c, result);
});

annotationsRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const result = await annotationsService.delete(id);

  return resultNoContent(c, result);
});
