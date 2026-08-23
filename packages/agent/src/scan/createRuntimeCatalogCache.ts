import type { AgentRuntimeCatalogEntry } from "@repo/schemas";

type RuntimeCatalogLoader = () => Promise<AgentRuntimeCatalogEntry[]>;

type RuntimeCatalogCacheOptions = {
  load: RuntimeCatalogLoader;
  ttlMs: number;
  now?: () => number;
};

export type RuntimeCatalogCache = {
  get: (seed?: AgentRuntimeCatalogEntry[]) => Promise<AgentRuntimeCatalogEntry[]>;
  refresh: RuntimeCatalogLoader;
  warm: () => void;
};

/**
 * Keeps runtime discovery process-local, coalesces concurrent scans, and serves
 * the last successful result while a stale catalog refreshes in the background.
 */
export const createRuntimeCatalogCache = ({
  load,
  ttlMs,
  now = Date.now,
}: RuntimeCatalogCacheOptions): RuntimeCatalogCache => {
  const state: {
    cached: { catalog: AgentRuntimeCatalogEntry[]; loadedAt: number } | undefined;
    inFlight: Promise<AgentRuntimeCatalogEntry[]> | undefined;
  } = { cached: undefined, inFlight: undefined };

  const refresh = (): Promise<AgentRuntimeCatalogEntry[]> => {
    if (state.inFlight) return state.inFlight;

    const request = load()
      .then((catalog) => {
        state.cached = { catalog, loadedAt: now() };

        return catalog;
      })
      .finally(() => {
        if (state.inFlight === request) state.inFlight = undefined;
      });
    state.inFlight = request;

    return request;
  };

  const get = async (seed?: AgentRuntimeCatalogEntry[]): Promise<AgentRuntimeCatalogEntry[]> => {
    if (!state.cached && seed) {
      state.cached = { catalog: seed, loadedAt: now() };
      void refresh().catch(() => undefined);

      return seed;
    }
    if (!state.cached) return refresh();
    if (now() - state.cached.loadedAt < ttlMs) return state.cached.catalog;

    void refresh().catch(() => undefined);

    return state.cached.catalog;
  };

  return {
    get,
    refresh,
    warm: () => {
      void refresh().catch(() => undefined);
    },
  };
};
