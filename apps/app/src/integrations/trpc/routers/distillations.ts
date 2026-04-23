import { z } from "zod/v4";
import { publicProcedure, router } from "../init";
import { distillationsService } from "../services";
import { DistillationSchema } from "@repo/schemas";

export const distillationsRouter = router({
  getMany: publicProcedure.query(() => distillationsService.getAll()),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => distillationsService.getById(input.id)),

  create: publicProcedure
    .input(DistillationSchema)
    .mutation(({ input }) => distillationsService.create(input)),

  update: publicProcedure
    .input(z.object({ id: z.string(), patch: DistillationSchema.partial() }))
    .mutation(({ input }) => distillationsService.update(input.id, input.patch)),

  run: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => distillationsService.run(input.id)),

  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => distillationsService.delete(input.id)),
});
