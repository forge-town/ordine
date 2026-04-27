import { describe, it, expect, vi } from "vitest";

const mockDao = {
  findMany: vi.fn().mockResolvedValue([{ id: "o1" , createdAt: new Date(0), updatedAt: new Date(0) }]),
  findById: vi.fn().mockResolvedValue({ id: "o1" , createdAt: new Date(0), updatedAt: new Date(0) }),
  create: vi.fn().mockResolvedValue({ id: "o1" , createdAt: new Date(0), updatedAt: new Date(0) }),
  update: vi.fn().mockResolvedValue({ id: "o1" , createdAt: new Date(0), updatedAt: new Date(0) }),
  delete: vi.fn().mockResolvedValue(undefined),
};

vi.mock("@repo/models", () => ({
  createOperationsDao: () => mockDao,
}));

import { createOperationsService } from "./createOperationsService";

describe("createOperationsService", () => {
  it("getAll delegates to dao.findMany", async () => {
    const svc = createOperationsService({} as never);
    const result = await svc.getAll();
    expect(mockDao.findMany).toHaveBeenCalled();
    expect(result).toEqual([{ id: "o1" , meta: { createdAt: new Date(0), updatedAt: new Date(0) } }]);
  });

  it("getById delegates to dao.findById", async () => {
    const svc = createOperationsService({} as never);
    await svc.getById("o1");
    expect(mockDao.findById).toHaveBeenCalledWith("o1");
  });

  it("create delegates to dao.create", async () => {
    const svc = createOperationsService({} as never);
    const data = { name: "op" } as never;
    await svc.create(data);
    expect(mockDao.create).toHaveBeenCalledWith(data);
  });

  it("update delegates to dao.update", async () => {
    const svc = createOperationsService({} as never);
    await svc.update("o1", { name: "updated" } as never);
    expect(mockDao.update).toHaveBeenCalledWith("o1", { name: "updated" });
  });

  it("delete delegates to dao.delete", async () => {
    const svc = createOperationsService({} as never);
    await svc.delete("o1");
    expect(mockDao.delete).toHaveBeenCalledWith("o1");
  });
});
