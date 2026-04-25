import { z } from "zod/v4";
import { publicProcedure, router } from "../init";
import { refinementsService } from "../services";

export const refinementsRouter = router({
  getMany: publicProcedure.query(() => refinementsService.getAll()),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => refinementsService.getById(input.id)),

  start: publicProcedure
    .input(z.object({ sourceDistillationId: z.string(), maxRounds: z.number().int().positive() }))
    .mutation(({ input }) => refinementsService.start(input)),

  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => refinementsService.delete(input.id)),
});
