import { z } from "zod/v4";
import { publicProcedure, router } from "../init";
import { agentsService } from "../services";
import { AgentSchema } from "@repo/schemas";

export const agentsRouter = router({
  getMany: publicProcedure.query(() => agentsService.getAll()),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => agentsService.getById(input.id)),

  create: publicProcedure.input(AgentSchema).mutation(({ input }) => agentsService.create(input)),

  update: publicProcedure
    .input(
      z.object({
        id: z.string(),
        patch: AgentSchema.partial(),
      })
    )
    .mutation(({ input }) => agentsService.update(input.id, input.patch)),

  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => agentsService.delete(input.id)),
});
