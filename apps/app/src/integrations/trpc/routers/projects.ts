import { randomUUID } from "node:crypto";
import { z } from "zod/v4";
import { CreateProjectSchema, UpdateProjectSchema } from "@repo/schemas";
import { publicProcedure, router } from "../init";
import { projectsService } from "../services";
import { unwrapResult } from "./result";

const CreateProjectRouteSchema = CreateProjectSchema.extend({
  id: z.string().default(() => randomUUID()),
});

export const projectsRouter = router({
  getMany: publicProcedure.query(async () => unwrapResult(await projectsService.getAll())),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => unwrapResult(await projectsService.getById(input.id))),

  create: publicProcedure
    .input(CreateProjectRouteSchema)
    .mutation(async ({ input }) => unwrapResult(await projectsService.create(input))),

  update: publicProcedure
    .input(z.object({ id: z.string(), patch: UpdateProjectSchema }))
    .mutation(async ({ input }) =>
      unwrapResult(await projectsService.update(input.id, input.patch)),
    ),

  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => unwrapResult(await projectsService.delete(input.id))),
});
