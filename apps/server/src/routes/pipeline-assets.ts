import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import { z } from "zod/v4";
import { CreatePipelineAssetSchema, UpdatePipelineAssetSchema } from "@repo/schemas";
import { pipelineAssetsService } from "../services.js";
import { resultJson, resultNoContent, validateJson, validationErrorJson } from "./result.js";

export const pipelineAssetsRoutes = new Hono();

const listQuerySchema = z.object({
  pipelineId: z.string().optional(),
});

const runStatsSchema = z.object({
  success: z.boolean(),
  durationMs: z.number().int().nonnegative(),
});

const CreatePipelineAssetRouteSchema = CreatePipelineAssetSchema.extend({
  id: z.string().default(() => randomUUID()),
});

pipelineAssetsRoutes.get("/", async (c) => {
  const parsed = listQuerySchema.safeParse({ pipelineId: c.req.query("pipelineId") });
  if (!parsed.success) return validationErrorJson(c);

  const result = parsed.data.pipelineId
    ? await pipelineAssetsService.getByPipelineId(parsed.data.pipelineId)
    : await pipelineAssetsService.getAll();

  return resultJson(c, result);
});

pipelineAssetsRoutes.post("/", async (c) => {
  const parsed = await validateJson(c, CreatePipelineAssetRouteSchema);
  if (!parsed.success) return validationErrorJson(c);

  const result = await pipelineAssetsService.create(parsed.data);

  return resultJson(c, result, 201);
});

pipelineAssetsRoutes.post("/distill/:pipelineId", async (c) => {
  const pipelineId = c.req.param("pipelineId");
  const result = await pipelineAssetsService.distillFromPipeline(pipelineId);

  return resultJson(c, result, 201);
});

pipelineAssetsRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const result = await pipelineAssetsService.getById(id);

  return resultJson(c, result);
});

pipelineAssetsRoutes.patch("/:id", async (c) => {
  const parsed = await validateJson(c, UpdatePipelineAssetSchema);
  if (!parsed.success) return validationErrorJson(c);

  const id = c.req.param("id");
  const result = await pipelineAssetsService.update(id, parsed.data);

  return resultJson(c, result);
});

pipelineAssetsRoutes.post("/:id/increment-run-stats", async (c) => {
  const parsed = await validateJson(c, runStatsSchema);
  if (!parsed.success) return validationErrorJson(c);

  const id = c.req.param("id");
  const result = await pipelineAssetsService.incrementRunStats(id, parsed.data);

  return resultJson(c, result);
});

pipelineAssetsRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const result = await pipelineAssetsService.delete(id);

  return resultNoContent(c, result);
});
