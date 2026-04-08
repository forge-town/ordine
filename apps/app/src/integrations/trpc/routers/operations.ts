import { z } from "zod/v4";
import { publicProcedure, router } from "../init";
import { operationsDao } from "@/models/daos/operationsDao";
import { VISIBILITY_OPTIONS, OBJECT_TYPES } from "@/models/tables/operations_table";

const VisibilityEnum = z.enum(VISIBILITY_OPTIONS);
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
        category: z.string().default("general"),
        visibility: VisibilityEnum.default("public"),
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
        category: z.string().optional(),
        visibility: VisibilityEnum.optional(),
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
