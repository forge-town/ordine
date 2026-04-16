import { describe, it, expect, vi } from "vitest";
import { createPipelinesService } from "./createPipelinesService";

const makeMockDao = () => ({
  findMany: vi.fn().mockResolvedValue([{ id: "p1" }]),
  findById: vi.fn().mockResolvedValue({ id: "p1" }),
  create: vi.fn().mockResolvedValue({ id: "p1" }),
  update: vi.fn().mockResolvedValue({ id: "p1" }),
  delete: vi.fn().mockResolvedValue(undefined),
});

describe("createPipelinesService", () => {
  it("getAll delegates to dao.findMany", async () => {
    const dao = makeMockDao();
    const svc = createPipelinesService(dao as never);
    const result = await svc.getAll();
    expect(dao.findMany).toHaveBeenCalled();
    expect(result).toEqual([{ id: "p1" }]);
  });

  it("getById delegates to dao.findById", async () => {
    const dao = makeMockDao();
    const svc = createPipelinesService(dao as never);
    await svc.getById("p1");
    expect(dao.findById).toHaveBeenCalledWith("p1");
  });

  it("create delegates to dao.create", async () => {
    const dao = makeMockDao();
    const svc = createPipelinesService(dao as never);
    const data = { name: "pipeline" } as never;
    await svc.create(data);
    expect(dao.create).toHaveBeenCalledWith(data);
  });

  it("update delegates to dao.update", async () => {
    const dao = makeMockDao();
    const svc = createPipelinesService(dao as never);
    await svc.update("p1", { name: "updated" } as never);
    expect(dao.update).toHaveBeenCalledWith("p1", { name: "updated" });
  });

  it("delete delegates to dao.delete", async () => {
    const dao = makeMockDao();
    const svc = createPipelinesService(dao as never);
    await svc.delete("p1");
    expect(dao.delete).toHaveBeenCalledWith("p1");
  });
});
