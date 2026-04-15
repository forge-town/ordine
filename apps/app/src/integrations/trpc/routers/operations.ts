import { z } from "zod/v4";
import { publicProcedure, router } from "../init";
import { operationsDao } from "@repo/models";
import { OBJECT_TYPES } from "@repo/db-schema";

const ObjectTypeEnum = z.enum(OBJECT_TYPES);

export const operationsRouter = router({
  getMany: publicProcedure.query(() => operationsDao.findMany()),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => operationsDao.findById(input.id)),

  create: publicProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string(),
        description: z.string().nullable().default(null),
        config: z.string().default("{}"),
        acceptedObjectTypes: z.array(ObjectTypeEnum).default(["file", "folder", "project"]),
      })
    )
    .mutation(({ input }) => operationsDao.create(input)),

  update: publicProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        description: z.string().nullable().optional(),
        config: z.string().optional(),
        acceptedObjectTypes: z.array(ObjectTypeEnum).optional(),
      })
    )
    .mutation(({ input }) => {
      const { id, ...rest } = input;
      return operationsDao.update(id, rest);
    }),

  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => operationsDao.delete(input.id)),
});
