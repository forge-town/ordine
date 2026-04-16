import { describe, it, expect, vi } from "vitest";
import { createRecipesService } from "./createRecipesService";

const makeMockDao = () => ({
  findMany: vi.fn().mockResolvedValue([{ id: "r1" }]),
  findById: vi.fn().mockResolvedValue({ id: "r1" }),
  findByOperationId: vi.fn().mockResolvedValue([{ id: "r1" }]),
  create: vi.fn().mockResolvedValue({ id: "r1" }),
  update: vi.fn().mockResolvedValue({ id: "r1" }),
  delete: vi.fn().mockResolvedValue(undefined),
});

describe("createRecipesService", () => {
  it("getAll delegates to dao.findMany", async () => {
    const dao = makeMockDao();
    const svc = createRecipesService(dao as never);
    const result = await svc.getAll();
    expect(dao.findMany).toHaveBeenCalled();
    expect(result).toEqual([{ id: "r1" }]);
  });

  it("getById delegates to dao.findById", async () => {
    const dao = makeMockDao();
    const svc = createRecipesService(dao as never);
    await svc.getById("r1");
    expect(dao.findById).toHaveBeenCalledWith("r1");
  });

  it("getByOperationId delegates to dao.findByOperationId", async () => {
    const dao = makeMockDao();
    const svc = createRecipesService(dao as never);
    await svc.getByOperationId("op1");
    expect(dao.findByOperationId).toHaveBeenCalledWith("op1");
  });

  it("create delegates to dao.create", async () => {
    const dao = makeMockDao();
    const svc = createRecipesService(dao as never);
    const data = { name: "recipe" } as never;
    await svc.create(data);
    expect(dao.create).toHaveBeenCalledWith(data);
  });

  it("update delegates to dao.update", async () => {
    const dao = makeMockDao();
    const svc = createRecipesService(dao as never);
    await svc.update("r1", { name: "updated" } as never);
    expect(dao.update).toHaveBeenCalledWith("r1", { name: "updated" });
  });

  it("delete delegates to dao.delete", async () => {
    const dao = makeMockDao();
    const svc = createRecipesService(dao as never);
    await svc.delete("r1");
    expect(dao.delete).toHaveBeenCalledWith("r1");
  });
});
