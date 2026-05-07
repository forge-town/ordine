import { z } from "zod/v4";
import { publicProcedure, router } from "../init";
import { agentRuntimesService } from "../services";
import { AgentRuntimeConfigSchema, type AgentRuntime } from "@repo/schemas";
import { scanRuntimes } from "@repo/agent";
import { getServerEnv } from "@/integrations/server-env";

const UpdatePatchSchema = AgentRuntimeConfigSchema.omit({ id: true }).partial();

const { RUNTIME_SCAN_MODE } = getServerEnv();

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

  scanAndSync: publicProcedure.mutation(async () => {
    if (RUNTIME_SCAN_MODE !== "local") return [];
    const detected = await scanRuntimes();
    const runtimes = detected.map((r) => ({
      id: `local-${r.type}`,
      name: r.type,
      type: r.type as AgentRuntime,
      connection: { mode: "local" as const },
    }));

    return agentRuntimesService.syncAll(runtimes);
  }),

  scanRuntimes: publicProcedure.query(() => (RUNTIME_SCAN_MODE === "local" ? scanRuntimes() : [])),
});
