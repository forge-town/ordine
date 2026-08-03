import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import { z } from "zod/v4";
import { CreateConnectorSchema, UpdateConnectorSchema } from "@repo/schemas";
import { connectorsService } from "../services.js";
import { resultJson, resultNoContent, validateJson, validationErrorJson } from "./result.js";

export const connectorsRoutes = new Hono();

const CreateConnectorRouteSchema = CreateConnectorSchema.extend({
  id: z.string().default(() => randomUUID()),
});

connectorsRoutes.get("/", async (c) => {
  const result = await connectorsService.getAll();

  return resultJson(c, result);
});

connectorsRoutes.post("/", async (c) => {
  const parsed = await validateJson(c, CreateConnectorRouteSchema);
  if (!parsed.success) return validationErrorJson(c);

  const result = await connectorsService.create(parsed.data);

  return resultJson(c, result, 201);
});

connectorsRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const result = await connectorsService.getById(id);

  return resultJson(c, result);
});

connectorsRoutes.patch("/:id", async (c) => {
  const parsed = await validateJson(c, UpdateConnectorSchema);
  if (!parsed.success) return validationErrorJson(c);

  const id = c.req.param("id");
  const result = await connectorsService.update(id, parsed.data);

  return resultJson(c, result);
});

connectorsRoutes.post("/:id/connect", async (c) => {
  const id = c.req.param("id");
  const result = await connectorsService.connect(id);

  return resultJson(c, result);
});

connectorsRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const result = await connectorsService.delete(id);

  return resultNoContent(c, result);
});
