import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import { z } from "zod/v4";
import { CreateConversationMessageSchema, UpdateConversationMessageSchema } from "@repo/schemas";
import { conversationMessagesService } from "../services.js";
import { resultJson, resultNoContent, validateJson, validationErrorJson } from "./result.js";

export const conversationsRoutes = new Hono();

const listQuerySchema = z.object({
  pipelineId: z.string().optional(),
  limit: z.coerce.number().int().positive().optional(),
});

const CreateConversationMessageRouteSchema = CreateConversationMessageSchema.extend({
  id: z.string().default(() => randomUUID()),
});

conversationsRoutes.get("/", async (c) => {
  const parsed = listQuerySchema.safeParse({
    pipelineId: c.req.query("pipelineId"),
    limit: c.req.query("limit"),
  });
  if (!parsed.success) return validationErrorJson(c);

  const result = parsed.data.pipelineId
    ? await conversationMessagesService.getByPipelineId(parsed.data.pipelineId, parsed.data.limit)
    : await conversationMessagesService.getAll();

  return resultJson(c, result);
});

conversationsRoutes.post("/", async (c) => {
  const parsed = await validateJson(c, CreateConversationMessageRouteSchema);
  if (!parsed.success) return validationErrorJson(c);

  const result = await conversationMessagesService.create(parsed.data);

  return resultJson(c, result, 201);
});

conversationsRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const result = await conversationMessagesService.getById(id);

  return resultJson(c, result);
});

conversationsRoutes.patch("/:id", async (c) => {
  const parsed = await validateJson(c, UpdateConversationMessageSchema);
  if (!parsed.success) return validationErrorJson(c);

  const id = c.req.param("id");
  const result = await conversationMessagesService.update(id, parsed.data);

  return resultJson(c, result);
});

conversationsRoutes.delete("/", async (c) => {
  const result = await conversationMessagesService.clearAll();

  return resultNoContent(c, result);
});

conversationsRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const result = await conversationMessagesService.delete(id);

  return resultNoContent(c, result);
});
