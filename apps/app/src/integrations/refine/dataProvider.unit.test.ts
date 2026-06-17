import { beforeEach, describe, expect, it, vi } from "vitest";

/** H3-03：dataProvider 薄封装层——响应包装、未知资源/URL 兜底、custom 路由。 */

// vi.mock 工厂被提升到文件顶部，引用的外部变量必须经 vi.hoisted 创建。
const { calls } = vi.hoisted(() => ({
  calls: [] as { args: unknown; kind: string; path: string }[],
}));

vi.mock("@/integrations/trpc/client", () => {
  const makeProc = (path: string) => ({
    query: async (args?: unknown) => {
      calls.push({ args, kind: "query", path });
      // 返回数组的方法：getMany（list 资源）与 getAgentRuns（jobs/analysis 对其 .map）。
      return path.endsWith("getMany") || path.endsWith("getAgentRuns")
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
      get: (_t, router: string) =>
        new Proxy({}, { get: (_t2, proc: string) => makeProc(`${router}.${String(proc)}`) }),
    },
  );

  return { trpcClient };
});

const { dataProvider, ResourceName, CustomEndpoint } = await import("./dataProvider");

beforeEach(() => {
  calls.length = 0;
});

describe("dataProvider response wrapping", () => {
  it("getList wraps { data, total: data.length }", async () => {
    const res = await dataProvider.getList!({ resource: ResourceName.agents });
    expect(res.total).toBe(2);
    expect(res.data).toHaveLength(2);
  });

  it("getOne wraps { data }", async () => {
    const res = await dataProvider.getOne!({ resource: ResourceName.agents, id: "a1" });
    expect(res.data).toMatchObject({ id: "one" });
  });
});

describe("dataProvider unknown-resource fallbacks (与迁移前 default 分支一致)", () => {
  it("getList throws on unknown resource", async () => {
    await expect(dataProvider.getList!({ resource: "nope" })).rejects.toThrow(
      'getList: unknown resource "nope"',
    );
  });
  it("deleteOne throws when resource has no deleteOne (e.g. jobs)", async () => {
    await expect(
      dataProvider.deleteOne!({ resource: ResourceName.jobs, id: "j1" }),
    ).rejects.toThrow('deleteOne: unknown resource "jobs"');
  });
});

describe("dataProvider.custom", () => {
  it("routes a known endpoint and wraps { data }", async () => {
    const res = await dataProvider.custom!({
      url: CustomEndpoint.jobsPause,
      method: "post",
      payload: { id: "j1" },
    });
    expect(calls.at(-1)).toMatchObject({ path: "jobs.pause", kind: "mutate", args: { id: "j1" } });
    expect(res.data).toMatchObject({ id: "mutated" });
  });

  it("composes jobs/analysis into { traces, agentRuns, spansByRun }", async () => {
    const res = await dataProvider.custom!({
      url: CustomEndpoint.jobsAnalysis,
      method: "post",
      payload: { jobId: "j1" },
    });
    expect(res.data).toHaveProperty("traces");
    expect(res.data).toHaveProperty("agentRuns");
    expect(res.data).toHaveProperty("spansByRun");
  });

  it("throws on unknown url", async () => {
    await expect(dataProvider.custom!({ url: "bogus/endpoint", method: "post" })).rejects.toThrow(
      'custom: unknown url "bogus/endpoint"',
    );
  });
});
