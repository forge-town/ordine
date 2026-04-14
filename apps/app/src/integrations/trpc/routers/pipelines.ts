import { z } from "zod/v4";
import { publicProcedure, router } from "../init";
import { pipelinesDao } from "@repo/models";
import { PipelineSchema } from "@/schemas";

export const pipelinesRouter = router({
  getMany: publicProcedure.query(() => pipelinesDao.findMany()),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => pipelinesDao.findById(input.id)),

  create: publicProcedure.input(PipelineSchema).mutation(({ input }) =>
    pipelinesDao.create({
      ...input,
      nodes: input.nodes as Parameters<typeof pipelinesDao.create>[0]["nodes"],
      edges: input.edges as Parameters<typeof pipelinesDao.create>[0]["edges"],
    })
  ),

  update: publicProcedure
    .input(z.object({ id: z.string(), patch: PipelineSchema.partial() }))
    .mutation(({ input }) =>
      pipelinesDao.update(input.id, {
        ...input.patch,
        nodes: input.patch.nodes as Parameters<typeof pipelinesDao.update>[1]["nodes"] | undefined,
        edges: input.patch.edges as Parameters<typeof pipelinesDao.update>[1]["edges"] | undefined,
      })
    ),

  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => pipelinesDao.delete(input.id)),
});
