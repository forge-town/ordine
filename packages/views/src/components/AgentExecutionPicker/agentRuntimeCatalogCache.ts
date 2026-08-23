import { Result } from "neverthrow";
import { z } from "zod";
import { AgentRuntimeCatalogEntrySchema, type AgentRuntimeCatalogEntry } from "@repo/schemas";

const AGENT_RUNTIME_CATALOG_CACHE_KEY = "ordine.agent-runtime-catalog.v1";
const AGENT_RUNTIME_CATALOG_CACHE_TTL_MS = 24 * 60 * 60 * 1_000;
const CachedAgentRuntimeCatalogSchema = z.object({
  savedAt: z.number().nonnegative(),
  catalog: z.array(AgentRuntimeCatalogEntrySchema),
});

type CatalogStorage = Pick<Storage, "getItem" | "setItem">;

const browserStorage = (): CatalogStorage | null =>
  typeof window === "undefined" ? null : window.localStorage;

export const readAgentRuntimeCatalogCache = (
  storage: CatalogStorage | null = browserStorage(),
  now = Date.now(),
): AgentRuntimeCatalogEntry[] => {
  if (!storage) return [];
  const stored = Result.fromThrowable(
    () => storage.getItem(AGENT_RUNTIME_CATALOG_CACHE_KEY),
    () => null,
  )();
  if (stored.isErr() || !stored.value) return [];
  const raw = stored.value;
  const parsed = Result.fromThrowable(
    () => JSON.parse(raw) as unknown,
    () => null,
  )();
  if (parsed.isErr()) return [];
  const cached = CachedAgentRuntimeCatalogSchema.safeParse(parsed.value);
  if (!cached.success || now - cached.data.savedAt > AGENT_RUNTIME_CATALOG_CACHE_TTL_MS) {
    return [];
  }

  return cached.data.catalog;
};

export const writeAgentRuntimeCatalogCache = (
  catalog: readonly AgentRuntimeCatalogEntry[],
  storage: CatalogStorage | null = browserStorage(),
  now = Date.now(),
): void => {
  if (!storage) return;
  Result.fromThrowable(
    () =>
      storage.setItem(AGENT_RUNTIME_CATALOG_CACHE_KEY, JSON.stringify({ savedAt: now, catalog })),
    () => null,
  )();
};
