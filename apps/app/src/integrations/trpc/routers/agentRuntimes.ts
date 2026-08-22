import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";
import { authedProcedure, publicProcedure, router } from "../init";
import { agentRuntimesService, capabilityHarvestService } from "../services";
import {
  AgentRuntimeConfigSchema,
  getLocalAgentRuntimeId,
  type AgentRuntime,
  type AgentRuntimeCatalogEntry,
  type AgentRuntimeConfig,
} from "@repo/schemas";
import { scanRuntimeCatalog, scanRuntimes } from "@repo/agent";
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
    ...(runtime.models === undefined ? {} : { models: runtime.models }),
    ...(runtime.modelsSource === undefined ? {} : { modelsSource: runtime.modelsSource }),
    detectedAt: new Date().toISOString(),
  },
});

const toCatalogRuntimeConfig = (entry: AgentRuntimeCatalogEntry): AgentRuntimeConfig | null => {
  if (!entry.path || entry.availability === "unavailable") return null;

  return {
    id: getLocalAgentRuntimeId(entry.runtime),
    name: entry.displayName,
    type: entry.runtime,
    connection: {
      mode: "local",
      binaryName: entry.binaryName,
      path: entry.path,
      ...(entry.version ? { version: entry.version } : {}),
      models: entry.models,
      modelsSource: entry.modelsSource,
      detectedAt: new Date().toISOString(),
    },
    compatibility: entry.compatibility,
  };
};

const mergeCatalogRuntimeConfigIds = (
  catalog: AgentRuntimeCatalogEntry[],
  runtimes: AgentRuntimeConfig[],
): AgentRuntimeCatalogEntry[] =>
  catalog.map((entry) => ({
    ...entry,
    runtimeConfigId:
      runtimes.find(
        (runtime) => runtime.type === entry.runtime && runtime.connection.mode === "local",
      )?.id ?? entry.runtimeConfigId,
  }));

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

  getCatalog: publicProcedure.query(async () => {
    if (!localRuntimeScanEnabled) return [];
    const [catalog, runtimes] = await Promise.all([
      scanRuntimeCatalog(),
      agentRuntimesService.getAll(),
    ]);

    return mergeCatalogRuntimeConfigIds(catalog, runtimes);
  }),

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

  rescanCatalog: publicProcedure.mutation(async () => {
    if (!localRuntimeScanEnabled) return [];
    const [catalog] = await Promise.all([scanRuntimeCatalog(), refreshGlobalCapabilities()]);
    const detected = catalog.flatMap((entry) => {
      const runtime = toCatalogRuntimeConfig(entry);

      return runtime ? [runtime] : [];
    });
    const runtimes = await agentRuntimesService.syncAll(detected);

    return mergeCatalogRuntimeConfigIds(catalog, runtimes);
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
