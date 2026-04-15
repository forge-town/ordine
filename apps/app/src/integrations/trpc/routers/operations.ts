import { z } from "zod/v4";
import { publicProcedure, router } from "../init";
import { operationsService } from "../services";
import { ObjectTypeSchema } from "@repo/schemas";

export const operationsRouter = router({
  getMany: publicProcedure.query(() => operationsService.getAll()),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => operationsService.getById(input.id)),

  create: publicProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string(),
        description: z.string().nullable().default(null),
        config: z.string().default("{}"),
        acceptedObjectTypes: z.array(ObjectTypeSchema).default(["file", "folder", "project"]),
      })
    )
    .mutation(({ input }) => operationsService.create(input)),

  update: publicProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        description: z.string().nullable().optional(),
        config: z.string().optional(),
        acceptedObjectTypes: z.array(ObjectTypeSchema).optional(),
      })
    )
    .mutation(({ input }) => {
      const { id, ...rest } = input;
      return operationsService.update(id, rest);
    }),

  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => operationsService.delete(input.id)),
});
