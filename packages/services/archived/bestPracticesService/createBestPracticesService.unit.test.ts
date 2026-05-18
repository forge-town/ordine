import { describe, it, expect, vi } from "vitest";

const mockDao = {
  findMany: vi.fn().mockResolvedValue([{ id: "1", title: "BP1" , createdAt: new Date(0), updatedAt: new Date(0) }]),
  findById: vi.fn().mockResolvedValue({ id: "1", title: "BP1" , createdAt: new Date(0), updatedAt: new Date(0) }),
  create: vi.fn().mockResolvedValue({ id: "1" , createdAt: new Date(0), updatedAt: new Date(0) }),
  update: vi.fn().mockResolvedValue({ id: "1" , createdAt: new Date(0), updatedAt: new Date(0) }),
  delete: vi.fn().mockResolvedValue(undefined),
};

vi.mock("@repo/models", () => ({
  createBestPracticesDao: () => mockDao,
}));

import { createBestPracticesService } from "./createBestPracticesService";

describe("createBestPracticesService", () => {
  it("getAll delegates to dao.findMany", async () => {
    const svc = createBestPracticesService({} as never);
    const result = await svc.getAll();
    expect(mockDao.findMany).toHaveBeenCalled();
    expect(result).toEqual([{ id: "1", title: "BP1" , meta: { createdAt: new Date(0), updatedAt: new Date(0) } }]);
  });

  it("getById delegates to dao.findById", async () => {
    const svc = createBestPracticesService({} as never);
    await svc.getById("1");
    expect(mockDao.findById).toHaveBeenCalledWith("1");
  });

  it("create delegates to dao.create", async () => {
    const svc = createBestPracticesService({} as never);
    const data = { title: "New" } as never;
    await svc.create(data);
    expect(mockDao.create).toHaveBeenCalledWith(data);
  });

  it("update delegates to dao.update", async () => {
    const svc = createBestPracticesService({} as never);
    await svc.update("1", { title: "Updated" } as never);
    expect(mockDao.update).toHaveBeenCalledWith("1", { title: "Updated" });
  });

  it("delete delegates to dao.delete", async () => {
    const svc = createBestPracticesService({} as never);
    await svc.delete("1");
    expect(mockDao.delete).toHaveBeenCalledWith("1");
  });
});
