import { describe, it, expect, vi } from "vitest";

const mockDao = {
  findMany: vi.fn().mockResolvedValue([{ id: "r1" }]),
  findById: vi.fn().mockResolvedValue({ id: "r1" }),
  findByOperationId: vi.fn().mockResolvedValue([{ id: "r1" }]),
  create: vi.fn().mockResolvedValue({ id: "r1" }),
  update: vi.fn().mockResolvedValue({ id: "r1" }),
  delete: vi.fn().mockResolvedValue(undefined),
};

vi.mock("@repo/models", () => ({
  createRecipesDao: () => mockDao,
}));

import { createRecipesService } from "./createRecipesService";

describe("createRecipesService", () => {
  it("getAll delegates to dao.findMany", async () => {
    const svc = createRecipesService({} as never);
    const result = await svc.getAll();
    expect(mockDao.findMany).toHaveBeenCalled();
    expect(result).toEqual([{ id: "r1" }]);
  });

  it("getById delegates to dao.findById", async () => {
    const svc = createRecipesService({} as never);
    await svc.getById("r1");
    expect(mockDao.findById).toHaveBeenCalledWith("r1");
  });

  it("getByOperationId delegates to dao.findByOperationId", async () => {
    const svc = createRecipesService({} as never);
    await svc.getByOperationId("op1");
    expect(mockDao.findByOperationId).toHaveBeenCalledWith("op1");
  });

  it("create delegates to dao.create", async () => {
    const svc = createRecipesService({} as never);
    const data = { name: "recipe" } as never;
    await svc.create(data);
    expect(mockDao.create).toHaveBeenCalledWith(data);
  });

  it("update delegates to dao.update", async () => {
    const svc = createRecipesService({} as never);
    await svc.update("r1", { name: "updated" } as never);
    expect(mockDao.update).toHaveBeenCalledWith("r1", { name: "updated" });
  });

  it("delete delegates to dao.delete", async () => {
    const svc = createRecipesService({} as never);
    await svc.delete("r1");
    expect(mockDao.delete).toHaveBeenCalledWith("r1");
  });
});
