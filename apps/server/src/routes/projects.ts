import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import { z } from "zod/v4";
import { CreateProjectSchema, UpdateProjectSchema } from "@repo/schemas";
import { projectsService } from "../services.js";
import { resultJson, resultNoContent, validateJson, validationErrorJson } from "./result.js";

export const projectsRoutes = new Hono();

const CreateProjectRouteSchema = CreateProjectSchema.extend({
  id: z.string().default(() => randomUUID()),
});

projectsRoutes.get("/", async (c) => {
  const result = await projectsService.getAll();

  return resultJson(c, result);
});

projectsRoutes.post("/", async (c) => {
  const parsed = await validateJson(c, CreateProjectRouteSchema);
  if (!parsed.success) return validationErrorJson(c);

  const result = await projectsService.create(parsed.data);

  return resultJson(c, result, 201);
});

projectsRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const result = await projectsService.getById(id);

  return resultJson(c, result);
});

projectsRoutes.patch("/:id", async (c) => {
  const parsed = await validateJson(c, UpdateProjectSchema);
  if (!parsed.success) return validationErrorJson(c);

  const id = c.req.param("id");
  const result = await projectsService.update(id, parsed.data);

  return resultJson(c, result);
});

projectsRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const result = await projectsService.delete(id);

  return resultNoContent(c, result);
});
