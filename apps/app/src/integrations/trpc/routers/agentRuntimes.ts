import { z } from "zod/v4";
import { publicProcedure, router } from "../init";
import { agentRuntimesService } from "../services";
import { AgentRuntimeConfigSchema } from "@repo/schemas";
import { scanRuntimes } from "@repo/agent";

const UpdatePatchSchema = AgentRuntimeConfigSchema.omit({ id: true }).partial();

export const agentRuntimesRouter = router({
  getMany: publicProcedure.query(() => agentRuntimesService.getAll()),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => agentRuntimesService.getById(input.id)),

  create: publicProcedure
    .input(AgentRuntimeConfigSchema)
    .mutation(({ input }) => agentRuntimesService.create(input)),

  update: publicProcedure
    .input(z.object({ id: z.string(), patch: UpdatePatchSchema }))
    .mutation(({ input }) => agentRuntimesService.update(input.id, input.patch)),

  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => agentRuntimesService.delete(input.id)),

  syncAll: publicProcedure
    .input(z.object({ runtimes: AgentRuntimeConfigSchema.array() }))
    .mutation(({ input }) => agentRuntimesService.syncAll(input.runtimes)),

  scanRuntimes: publicProcedure.query(() => scanRuntimes()),
});
