import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import { z } from "zod/v4";
import {
  CreateRoutineSchema,
  RoutineOccurrencesInputSchema,
  UpdateRoutineSchema,
} from "@repo/schemas";
import { routinesService } from "../services.js";
import { resultJson, validateJson, validationErrorJson } from "./result.js";

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

  const routines = parsed.data.pipelineId
    ? await routinesService.getByPipelineId(parsed.data.pipelineId)
    : parsed.data.enabled === "true"
      ? await routinesService.getEnabled()
      : await routinesService.getAll();

  const filtered =
    parsed.data.enabled === undefined
      ? routines
      : routines.filter((routine) => routine.enabled === (parsed.data.enabled === "true"));

  return c.json(filtered);
});

routinesRoutes.get("/occurrences", async (c) => {
  const parsed = RoutineOccurrencesInputSchema.safeParse({
    from: c.req.query("from"),
    to: c.req.query("to"),
  });
  if (!parsed.success) return validationErrorJson(c);

  return c.json(
    await routinesService.getOccurrences(new Date(parsed.data.from), new Date(parsed.data.to)),
  );
});

routinesRoutes.post("/", async (c) => {
  const parsed = await validateJson(c, CreateRoutineRouteSchema);
  if (!parsed.success) return validationErrorJson(c);

  const result = await routinesService.create(parsed.data);

  return resultJson(c, result, 201);
});

routinesRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const routine = await routinesService.getById(id);
  if (!routine) return c.json({ error: "Routine not found" }, 404);

  return c.json(routine);
});

routinesRoutes.patch("/:id", async (c) => {
  const parsed = await validateJson(c, UpdateRoutineSchema);
  if (!parsed.success) return validationErrorJson(c);

  const id = c.req.param("id");
  const result = await routinesService.update(id, parsed.data);

  return resultJson(c, result);
});

routinesRoutes.post("/:id/run-now", async (c) => {
  const id = c.req.param("id");
  const result = await routinesService.runNow(id);

  return resultJson(c, result, 202);
});

routinesRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  await routinesService.delete(id);

  return c.body(null, 204);
});
