import type { AgentRuntimeCatalogEntry } from "@repo/schemas";
import { describe, expect, it, vi } from "vitest";
import { createRuntimeCatalogCache } from "./createRuntimeCatalogCache";

const catalog = (runtime: AgentRuntimeCatalogEntry["runtime"]): AgentRuntimeCatalogEntry[] =>
  [{ runtime }] as AgentRuntimeCatalogEntry[];

const deferred = <T>() => {
  const state: {
    reject?: (reason?: unknown) => void;
    resolve?: (value: T) => void;
  } = {};
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    state.resolve = resolvePromise;
    state.reject = rejectPromise;
  });

  return {
    promise,
    reject: (reason?: unknown) => state.reject?.(reason),
    resolve: (value: T) => state.resolve?.(value),
  };
};

describe("createRuntimeCatalogCache", () => {
  it("coalesces concurrent cold scans", async () => {
    const pending = deferred<AgentRuntimeCatalogEntry[]>();
    const load = vi.fn(() => pending.promise);
    const cache = createRuntimeCatalogCache({ load, ttlMs: 60_000 });

    const first = cache.get();
    const second = cache.get();
    pending.resolve(catalog("codex"));

    await expect(first).resolves.toEqual(catalog("codex"));
    await expect(second).resolves.toEqual(catalog("codex"));
    expect(load).toHaveBeenCalledOnce();
  });

  it("returns a fresh catalog without another scan", async () => {
    const load = vi.fn().mockResolvedValue(catalog("codex"));
    const cache = createRuntimeCatalogCache({ load, ttlMs: 60_000 });

    await cache.get();
    await expect(cache.get()).resolves.toEqual(catalog("codex"));
    expect(load).toHaveBeenCalledOnce();
  });

  it("serves a stale catalog while one background refresh updates it", async () => {
    const clock = { currentTime: 0 };
    const pending = deferred<AgentRuntimeCatalogEntry[]>();
    const load = vi
      .fn<RuntimeCatalogLoader>()
      .mockResolvedValueOnce(catalog("codex"))
      .mockImplementationOnce(() => pending.promise);
    const cache = createRuntimeCatalogCache({
      load,
      now: () => clock.currentTime,
      ttlMs: 100,
    });

    await cache.get();
    clock.currentTime = 101;
    await expect(cache.get()).resolves.toEqual(catalog("codex"));
    expect(load).toHaveBeenCalledTimes(2);

    pending.resolve(catalog("opencode"));
    await expect(cache.refresh()).resolves.toEqual(catalog("opencode"));
    await expect(cache.get()).resolves.toEqual(catalog("opencode"));
  });

  it("keeps the last successful catalog when a refresh fails", async () => {
    const clock = { currentTime: 0 };
    const pending = deferred<AgentRuntimeCatalogEntry[]>();
    const load = vi
      .fn<RuntimeCatalogLoader>()
      .mockResolvedValueOnce(catalog("codex"))
      .mockImplementationOnce(() => pending.promise);
    const cache = createRuntimeCatalogCache({
      load,
      now: () => clock.currentTime,
      ttlMs: 100,
    });

    await cache.get();
    clock.currentTime = 101;
    await expect(cache.get()).resolves.toEqual(catalog("codex"));
    pending.reject(new Error("probe failed"));
    await expect(cache.refresh()).rejects.toThrow("probe failed");
    clock.currentTime = 0;
    await expect(cache.get()).resolves.toEqual(catalog("codex"));
  });

  it("warms the catalog without surfacing loader failures", async () => {
    const load = vi.fn().mockRejectedValue(new Error("probe failed"));
    const cache = createRuntimeCatalogCache({ load, ttlMs: 60_000 });

    cache.warm();
    await vi.waitFor(() => expect(load).toHaveBeenCalledOnce());
  });
});

type RuntimeCatalogLoader = () => Promise<AgentRuntimeCatalogEntry[]>;
