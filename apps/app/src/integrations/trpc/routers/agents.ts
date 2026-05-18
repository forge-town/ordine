import { z } from "zod/v4";
import { authedProcedure, router } from "../init";
import { agentsService } from "../services";
import { AgentIdSchema, AgentPatchSchema, AgentSchema } from "@repo/schemas";

export const agentsRouter = router({
  getMany: authedProcedure.query(() => agentsService.getAll()),

  getById: authedProcedure
    .input(z.object({ id: AgentIdSchema }))
    .query(({ input }) => agentsService.getById(input.id)),

  create: authedProcedure.input(AgentSchema).mutation(({ input }) => agentsService.create(input)),

  update: authedProcedure
    .input(
      z.object({
        id: AgentIdSchema,
        patch: AgentPatchSchema,
      }),
    )
    .mutation(({ input }) => agentsService.update(input.id, input.patch)),

  delete: authedProcedure
    .input(z.object({ id: AgentIdSchema }))
    .mutation(({ input }) => agentsService.delete(input.id)),
});
