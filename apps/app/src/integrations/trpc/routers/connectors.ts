import { randomUUID } from "node:crypto";
import { z } from "zod/v4";
import { CreateConnectorSchema, UpdateConnectorSchema } from "@repo/schemas";
import { authedProcedure, publicProcedure, router } from "../init";
import { connectorsService } from "../services";
import { unwrapResult } from "./result";

const CreateConnectorRouteSchema = CreateConnectorSchema.extend({
  id: z.string().default(() => randomUUID()),
});

export const connectorsRouter = router({
  getMany: publicProcedure.query(async () => unwrapResult(await connectorsService.getAll())),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => unwrapResult(await connectorsService.getById(input.id))),

  create: authedProcedure
    .input(CreateConnectorRouteSchema)
    .mutation(async ({ input }) => unwrapResult(await connectorsService.create(input))),

  update: authedProcedure
    .input(z.object({ id: z.string(), patch: UpdateConnectorSchema }))
    .mutation(async ({ input }) =>
      unwrapResult(await connectorsService.update(input.id, input.patch)),
    ),

  connect: authedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => unwrapResult(await connectorsService.connect(input.id))),

  delete: authedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => unwrapResult(await connectorsService.delete(input.id))),
});
