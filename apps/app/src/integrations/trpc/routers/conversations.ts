import { randomUUID } from "node:crypto";
import { z } from "zod/v4";
import { CreateConversationMessageSchema, UpdateConversationMessageSchema } from "@repo/schemas";
import { publicProcedure, router } from "../init";
import { conversationMessagesService } from "../services";
import { unwrapResult } from "./result";

const CreateConversationMessageRouteSchema = CreateConversationMessageSchema.extend({
  id: z.string().default(() => randomUUID()),
});

export const conversationsRouter = router({
  getMany: publicProcedure
    .input(
      z
        .object({
          pipelineId: z.string().optional(),
          limit: z.number().int().positive().optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const result = input?.pipelineId
        ? await conversationMessagesService.getByPipelineId(input.pipelineId, input.limit)
        : await conversationMessagesService.getAll();

      return unwrapResult(result);
    }),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => unwrapResult(await conversationMessagesService.getById(input.id))),

  create: publicProcedure
    .input(CreateConversationMessageRouteSchema)
    .mutation(async ({ input }) => unwrapResult(await conversationMessagesService.create(input))),

  update: publicProcedure
    .input(z.object({ id: z.string(), patch: UpdateConversationMessageSchema }))
    .mutation(async ({ input }) =>
      unwrapResult(await conversationMessagesService.update(input.id, input.patch)),
    ),

  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) =>
      unwrapResult(await conversationMessagesService.delete(input.id)),
    ),
});
