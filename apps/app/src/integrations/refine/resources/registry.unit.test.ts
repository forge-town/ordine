import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ListFilters } from "./types";

const { calls } = vi.hoisted(() => ({
  calls: [] as Array<{ args: unknown; kind: "query" | "mutate"; path: string }>,
}));

vi.mock("@/integrations/trpc/client", () => {
  const makeProcedure = (path: string) => ({
    query: async (args?: unknown) => {
      calls.push({ args, kind: "query", path });

      return [];
    },
    mutate: async (args?: unknown) => {
      calls.push({ args, kind: "mutate", path });

      return { id: "result" };
    },
  });
  const trpcClient = new Proxy(
    {},
    {
      get: (_target, router: string) =>
        new Proxy(
          {},
          { get: (_innerTarget, procedure: string) => makeProcedure(`${router}.${procedure}`) },
        ),
    },
  );

  return { trpcClient };
});

const { resourceHandlers } = await import("./registry");

const noFilters: ListFilters = {
  boolean: () => undefined,
  number: () => undefined,
  string: () => undefined,
};

const latestCall = () => calls.at(-1);

beforeEach(() => {
  calls.length = 0;
});

describe("COD-122 resource registry", () => {
  it.each([
    ["connectors", "connectors"],
    ["conversationMessages", "conversations"],
    ["pipelineAssets", "pipelineAssets"],
    ["projects", "projects"],
    ["routines", "routines"],
  ] as const)("routes %s CRUD through the %s router", async (resource, router) => {
    const handler = resourceHandlers[resource]!;

    await handler.getOne!("item-1");
    expect(latestCall()).toEqual({
      args: { id: "item-1" },
      kind: "query",
      path: `${router}.getById`,
    });

    await handler.create!({ name: "created" });
    expect(latestCall()).toEqual({
      args: { name: "created" },
      kind: "mutate",
      path: `${router}.create`,
    });

    await handler.update!("item-1", { name: "updated" });
    expect(latestCall()).toEqual({
      args: { id: "item-1", patch: { name: "updated" } },
      kind: "mutate",
      path: `${router}.update`,
    });

    await handler.deleteOne!("item-1");
    expect(latestCall()).toEqual({
      args: { id: "item-1" },
      kind: "mutate",
      path: `${router}.delete`,
    });
  });

  it("maps conversation, asset, and routine list filters", async () => {
    const filters: ListFilters = {
      boolean: (field) => (field === "enabled" ? false : undefined),
      number: (field) => (field === "limit" ? 25 : undefined),
      string: (field) => (field === "pipelineId" ? "pipeline-1" : undefined),
    };

    await resourceHandlers.conversationMessages!.getList!(
      { resource: "conversationMessages" },
      filters,
    );
    await resourceHandlers.pipelineAssets!.getList!({ resource: "pipelineAssets" }, filters);
    await resourceHandlers.routines!.getList!({ resource: "routines" }, filters);

    expect(calls).toEqual([
      {
        args: { limit: 25, pipelineId: "pipeline-1" },
        kind: "query",
        path: "conversations.getMany",
      },
      {
        args: { pipelineId: "pipeline-1" },
        kind: "query",
        path: "pipelineAssets.getMany",
      },
      {
        args: { enabled: false, pipelineId: "pipeline-1" },
        kind: "query",
        path: "routines.getMany",
      },
    ]);
  });
});

describe("legacy resource mapping guards", () => {
  it("keeps pipeline pending operations outside the pipeline payload", async () => {
    await resourceHandlers.pipelines!.create!({
      name: "Pipeline",
      pendingOperations: [{ id: "operation-1" }],
    });

    expect(latestCall()).toEqual({
      args: {
        pendingOperations: [{ id: "operation-1" }],
        pipeline: { name: "Pipeline" },
      },
      kind: "mutate",
      path: "pipelines.create",
    });
  });

  it("keeps exceptional operation, filesystem, and settings shapes", async () => {
    await resourceHandlers.operations!.update!("operation-1", { label: "Updated" });
    expect(latestCall()?.args).toEqual({ id: "operation-1", label: "Updated" });

    await resourceHandlers.filesystem!.getList!({ resource: "filesystem" }, noFilters);
    expect(latestCall()).toMatchObject({ args: { path: undefined }, path: "filesystem.browse" });

    await resourceHandlers.settings!.update!("ignored", { language: "zh" });
    expect(latestCall()).toMatchObject({
      args: { language: "zh" },
      path: "settings.update",
    });
  });
});
