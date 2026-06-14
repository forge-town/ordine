import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import { z } from "zod/v4";
import { CreateRoutineSchema, UpdateRoutineSchema } from "@repo/schemas";
import { routinesService } from "../services.js";
import { resultJson, resultNoContent, validateJson, validationErrorJson } from "./result.js";

export const routinesRoutes = new Hono();

const listQuerySchema = z.object({
  pipelineId: z.string().optional(),
  enabled: z.enum(["true", "false"]).optional(),
});

const CreateRoutineRouteSchema = CreateRoutineSchema.extend({
  id: z.string().default(() => randomUUID()),
});

routinesRoutes.get("/", async (c) => {
  const parsed = listQuerySchema.safeParse({
    pipelineId: c.req.query("pipelineId"),
    enabled: c.req.query("enabled"),
  });
  if (!parsed.success) return validationErrorJson(c);

  const result = parsed.data.pipelineId
    ? await routinesService.getByPipelineId(parsed.data.pipelineId)
    : parsed.data.enabled === "true"
      ? await routinesService.getEnabled()
      : await routinesService.getAll();

  return resultJson(c, result);
});

routinesRoutes.post("/", async (c) => {
  const parsed = await validateJson(c, CreateRoutineRouteSchema);
  if (!parsed.success) return validationErrorJson(c);

  const result = await routinesService.create(parsed.data);

  return resultJson(c, result, 201);
});

routinesRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const result = await routinesService.getById(id);

  return resultJson(c, result);
});

routinesRoutes.patch("/:id", async (c) => {
  const parsed = await validateJson(c, UpdateRoutineSchema);
  if (!parsed.success) return validationErrorJson(c);

  const id = c.req.param("id");
  const result = await routinesService.update(id, parsed.data);

  return resultJson(c, result);
});

routinesRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const result = await routinesService.delete(id);

  return resultNoContent(c, result);
});
