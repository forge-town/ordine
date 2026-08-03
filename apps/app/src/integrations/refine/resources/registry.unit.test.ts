import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * H3-03 行为护栏：mock trpcClient 为"记录调用"的 Proxy，断言每个资源 handler
 * 路由到正确的 trpc 过程、参数映射与迁移前一致。重点覆盖标准 CRUD + 全部例外。
 */

// vi.mock 工厂被提升到文件顶部，引用的外部变量必须经 vi.hoisted 创建。
const { calls } = vi.hoisted(() => ({
  calls: [] as { args: unknown; kind: string; path: string }[],
}));

vi.mock("@/integrations/trpc/client", () => {
  const makeProc = (path: string) => ({
    query: async (args?: unknown) => {
      calls.push({ args, kind: "query", path });

      return [];
    },
    mutate: async (args?: unknown) => {
      calls.push({ args, kind: "mutate", path });

      return [];
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

const { resourceHandlers } = await import("./registry");
import type { ListFilters } from "./types";

const noFilters: ListFilters = {
  string: () => undefined,
  number: () => undefined,
  boolean: () => undefined,
};

const last = () => calls.at(-1)!;

beforeEach(() => {
  calls.length = 0;
});

describe("resourceHandlers — 标准 CRUD 路由 (agents 为代表)", () => {
  const h = resourceHandlers.agents!;

  it("getList → agents.getMany.query", async () => {
    await h.getList!({ resource: "agents" }, noFilters);
    expect(last()).toMatchObject({ path: "agents.getMany", kind: "query" });
  });
  it("getOne → agents.getById.query({id})", async () => {
    await h.getOne!("a1");
    expect(last()).toMatchObject({ path: "agents.getById", kind: "query", args: { id: "a1" } });
  });
  it("create → agents.create.mutate(variables)", async () => {
    await h.create!({ name: "x" });
    expect(last()).toMatchObject({ path: "agents.create", kind: "mutate", args: { name: "x" } });
  });
  it("update → agents.update.mutate({id, patch})", async () => {
    await h.update!("a1", { name: "y" });
    expect(last()).toMatchObject({
      path: "agents.update",
      kind: "mutate",
      args: { id: "a1", patch: { name: "y" } },
    });
  });
  it("deleteOne → agents.delete.mutate({id})", async () => {
    await h.deleteOne!("a1");
    expect(last()).toMatchObject({ path: "agents.delete", kind: "mutate", args: { id: "a1" } });
  });
});

describe("resourceHandlers — 例外项（迁移最易出错处）", () => {
  it("conversationMessages 路由到 conversations router", async () => {
    const h = resourceHandlers.conversationMessages!;
    await h.getList!(
      { resource: "conversationMessages" },
      {
        ...noFilters,
        string: (f) => (f === "pipelineId" ? "p1" : undefined),
        number: (f) => (f === "limit" ? 20 : undefined),
      },
    );
    expect(last()).toMatchObject({
      path: "conversations.getMany",
      args: { pipelineId: "p1", limit: 20 },
    });
    await h.getOne!("c1");
    expect(last().path).toBe("conversations.getById");
    await h.deleteOne!("c1");
    expect(last().path).toBe("conversations.delete");
  });

  it("operations.update 用展开而非 patch", async () => {
    await resourceHandlers.operations!.update!("o1", { label: "L" });
    expect(last()).toMatchObject({
      path: "operations.update",
      args: { id: "o1", label: "L" },
    });
    expect((last().args as Record<string, unknown>).patch).toBeUndefined();
  });

  it("jobs.update → updateStatus 展开，无 deleteOne", async () => {
    await resourceHandlers.jobs!.update!("j1", { status: "done" });
    expect(last()).toMatchObject({
      path: "jobs.updateStatus",
      args: { id: "j1", status: "done" },
    });
    expect(resourceHandlers.jobs!.deleteOne).toBeUndefined();
  });

  it("settings.getOne 无 id，settings.update 直传 variables 无 id", async () => {
    await resourceHandlers.settings!.getOne!("ignored");
    expect(last()).toMatchObject({ path: "settings.get", kind: "query" });
    expect(last().args).toBeUndefined();
    await resourceHandlers.settings!.update!("ignored", { theme: "dark" });
    expect(last()).toMatchObject({ path: "settings.update", args: { theme: "dark" } });
  });

  it("pipelines.create 拆出 pendingOperations", async () => {
    await resourceHandlers.pipelines!.create!({
      name: "P",
      nodes: [],
      pendingOperations: [{ id: "op1" }],
    });
    expect(last()).toMatchObject({
      path: "pipelines.create",
      args: { pipeline: { name: "P", nodes: [] }, pendingOperations: [{ id: "op1" }] },
    });
  });

  it("skillDraftOperations/skillAnalyses/refinements 仅 getOne，路由到对应过程", async () => {
    await resourceHandlers.skillDraftOperations!.getOne!("s1");
    expect(last()).toMatchObject({ path: "skills.draftOperation", args: { id: "s1" } });
    await resourceHandlers.skillAnalyses!.getOne!("s1");
    expect(last()).toMatchObject({ path: "skills.analyze", args: { id: "s1" } });
    await resourceHandlers.refinements!.getOne!("r1");
    expect(last()).toMatchObject({ path: "refinements.getById", args: { id: "r1" } });
  });

  it("filesystem 仅 getList → filesystem.browse({path})", async () => {
    await resourceHandlers.filesystem!.getList!(
      { resource: "filesystem" },
      {
        ...noFilters,
        string: (f) => (f === "path" ? "/tmp" : undefined),
      },
    );
    expect(last()).toMatchObject({ path: "filesystem.browse", args: { path: "/tmp" } });
  });

  it("routines.getList 传 pipelineId + enabled(boolean)", async () => {
    await resourceHandlers.routines!.getList!(
      { resource: "routines" },
      {
        ...noFilters,
        string: (f) => (f === "pipelineId" ? "p1" : undefined),
        boolean: (f) => (f === "enabled" ? true : undefined),
      },
    );
    expect(last()).toMatchObject({
      path: "routines.getMany",
      args: { pipelineId: "p1", enabled: true },
    });
  });
});
