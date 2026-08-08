import { beforeEach, describe, expect, it, vi } from "vitest";

const { calls } = vi.hoisted(() => ({
  calls: [] as Array<{ args: unknown; kind: "query" | "mutate"; path: string }>,
}));

vi.mock("@/integrations/trpc/client", () => {
  const makeProcedure = (path: string) => ({
    query: async (args?: unknown) => {
      calls.push({ args, kind: "query", path });

      return path.endsWith("getMany") || path.endsWith("browse")
        ? [{ id: "1" }, { id: "2" }]
        : { id: "one" };
    },
    mutate: async (args?: unknown) => {
      calls.push({ args, kind: "mutate", path });

      return { id: "mutated" };
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

const { CustomEndpoint, ResourceName, dataProvider } = await import("./dataProvider");

beforeEach(() => {
  calls.length = 0;
});

describe("dataProvider resource registry", () => {
  it("wraps standard resource responses", async () => {
    const list = await dataProvider.getList!({ resource: ResourceName.agents });
    const one = await dataProvider.getOne!({ resource: ResourceName.projects, id: 7 });

    expect(list).toMatchObject({ total: 2 });
    expect(one.data).toEqual({ id: "one" });
    expect(calls.at(-1)).toMatchObject({ path: "projects.getById", args: { id: "7" } });
  });

  it("converts list filters for COD-122 resources", async () => {
    await dataProvider.getList!({
      resource: ResourceName.routines,
      filters: [
        { field: "pipelineId", operator: "eq", value: "pipeline-1" },
        { field: "enabled", operator: "eq", value: "true" },
      ],
    });
    await dataProvider.getList!({
      resource: ResourceName.conversationMessages,
      filters: [
        { field: "pipelineId", operator: "eq", value: "pipeline-1" },
        { field: "limit", operator: "eq", value: "20" },
      ],
    });

    expect(calls).toEqual([
      {
        path: "routines.getMany",
        kind: "query",
        args: { pipelineId: "pipeline-1", enabled: true },
      },
      {
        path: "conversations.getMany",
        kind: "query",
        args: { pipelineId: "pipeline-1", limit: 20 },
      },
    ]);
  });

  it("throws when a resource does not implement the requested method", async () => {
    await expect(
      dataProvider.deleteOne!({ resource: ResourceName.jobs, id: "job-1" }),
    ).rejects.toThrow('deleteOne: unknown resource "jobs"');
    await expect(dataProvider.getList!({ resource: "unknown" })).rejects.toThrow(
      'getList: unknown resource "unknown"',
    );
  });
});

describe("dataProvider custom registry", () => {
  it("routes Web conversation history clearing through its tRPC mutation", async () => {
    const response = await dataProvider.custom!({
      url: CustomEndpoint.conversationsClearAll,
      method: "delete",
      payload: {},
    });

    expect(response.data).toEqual({ id: "mutated" });
    expect(calls.at(-1)).toEqual({
      path: "conversations.clearAll",
      kind: "mutate",
      args: undefined,
    });
  });

  it("routes COD-122 actions through named endpoints", async () => {
    const response = await dataProvider.custom!({
      url: CustomEndpoint.routinesRunNow,
      method: "post",
      payload: { id: "routine-1" },
    });

    expect(response.data).toEqual({ id: "mutated" });
    expect(calls.at(-1)).toEqual({
      path: "routines.runNow",
      kind: "mutate",
      args: { id: "routine-1" },
    });
  });

  it("loads server-expanded routine occurrences through the named endpoint", async () => {
    await dataProvider.custom!({
      url: CustomEndpoint.routinesOccurrences,
      method: "get",
      payload: {
        from: "2026-08-03T00:00:00.000Z",
        to: "2026-08-10T00:00:00.000Z",
      },
    });

    expect(calls.at(-1)).toEqual({
      path: "routines.getOccurrences",
      kind: "query",
      args: {
        from: "2026-08-03T00:00:00.000Z",
        to: "2026-08-10T00:00:00.000Z",
      },
    });
  });

  it("routes job controls through their tRPC mutations", async () => {
    await dataProvider.custom!({
      url: CustomEndpoint.jobsPause,
      method: "post",
      payload: { jobId: "job-1" },
    });
    await dataProvider.custom!({
      url: CustomEndpoint.jobsResume,
      method: "post",
      payload: { jobId: "job-1" },
    });
    await dataProvider.custom!({
      url: CustomEndpoint.jobsCancel,
      method: "post",
      payload: { jobId: "job-1" },
    });

    expect(calls.slice(-3)).toEqual([
      { path: "jobs.pause", kind: "mutate", args: { jobId: "job-1" } },
      { path: "jobs.resume", kind: "mutate", args: { jobId: "job-1" } },
      { path: "jobs.cancel", kind: "mutate", args: { jobId: "job-1" } },
    ]);
  });

  it("throws for unknown custom urls", async () => {
    await expect(dataProvider.custom!({ url: "unknown", method: "post" })).rejects.toThrow(
      'custom: unknown url "unknown"',
    );
  });
});
