import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";
import { authedProcedure, publicProcedure, router } from "../init";
import { agentRuntimesService, capabilityHarvestService } from "../services";
import { AgentRuntimeConfigSchema, getLocalAgentRuntimeId, type AgentRuntime } from "@repo/schemas";
import { scanRuntimes } from "@repo/agent";
import { getServerEnv } from "@/integrations/server-env";
import { unwrapResult } from "./result";

const UpdatePatchSchema = AgentRuntimeConfigSchema.omit({ id: true }).partial();

const { ORDINE_LOCAL_MODE, RUNTIME_SCAN_MODE } = getServerEnv();
const localRuntimeScanEnabled = RUNTIME_SCAN_MODE === "local" || ORDINE_LOCAL_MODE;

const harvestGlobalCapabilitiesOnce = async () =>
  unwrapResult(await capabilityHarvestService.harvestOnce({}));

const refreshGlobalCapabilities = async () =>
  unwrapResult(await capabilityHarvestService.harvest({}));

const toLocalRuntimeConfig = (runtime: Awaited<ReturnType<typeof scanRuntimes>>[number]) => ({
  id: getLocalAgentRuntimeId(runtime.type as AgentRuntime),
  name: runtime.type,
  type: runtime.type as AgentRuntime,
  connection: {
    mode: "local" as const,
    binaryName: runtime.binaryName,
    path: runtime.path,
    version: runtime.version,
    detectedAt: new Date().toISOString(),
  },
});

export const agentRuntimesRouter = router({
  getMany: publicProcedure.query(async () => {
    const [runtimes] = await Promise.all([
      agentRuntimesService.getAll(),
      ...(localRuntimeScanEnabled ? [harvestGlobalCapabilitiesOnce()] : []),
    ]);
    if (runtimes.length > 0 || !localRuntimeScanEnabled) {
      return runtimes;
    }

    const detected = await scanRuntimes();
    if (detected.length === 0) {
      return runtimes;
    }

    return agentRuntimesService.syncAll(detected.map(toLocalRuntimeConfig));
  }),

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
    if (!localRuntimeScanEnabled) return [];
    const [detected] = await Promise.all([scanRuntimes(), refreshGlobalCapabilities()]);
    const runtimes = detected.map(toLocalRuntimeConfig);

    return agentRuntimesService.syncAll(runtimes);
  }),

  scanRuntimes: publicProcedure.query(() => (localRuntimeScanEnabled ? scanRuntimes() : [])),

  harvestCapabilities: authedProcedure
    .input(z.object({ workspacePath: z.string().min(1).optional() }))
    .mutation(async ({ input }) => {
      if (!localRuntimeScanEnabled) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Capability harvesting is only available in local runtime scan mode",
        });
      }

      return unwrapResult(await capabilityHarvestService.harvest(input));
    }),
});
