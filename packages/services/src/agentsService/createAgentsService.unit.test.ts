import { describe, it, expect, vi } from "vitest";

const mockDao = {
  findMany: vi.fn().mockResolvedValue([{ id: "ag1", createdAt: new Date(0), updatedAt: new Date(0) }]),
  findById: vi.fn().mockResolvedValue({ id: "ag1", createdAt: new Date(0), updatedAt: new Date(0) }),
  create: vi.fn().mockResolvedValue({ id: "ag1", createdAt: new Date(0), updatedAt: new Date(0) }),
  update: vi.fn().mockResolvedValue({ id: "ag1", createdAt: new Date(0), updatedAt: new Date(0) }),
  delete: vi.fn().mockResolvedValue(undefined),
};

vi.mock("@repo/models", () => ({
  createAgentsDao: () => mockDao,
}));

import { createAgentsService } from "./createAgentsService";

describe("createAgentsService", () => {
  it("getAll delegates to dao.findMany", async () => {
    const svc = createAgentsService({} as never);
    const result = await svc.getAll();
    expect(mockDao.findMany).toHaveBeenCalled();
    expect(result).toEqual([{ id: "ag1", meta: { createdAt: new Date(0), updatedAt: new Date(0) } }]);
  });

  it("getById delegates to dao.findById", async () => {
    const svc = createAgentsService({} as never);
    await svc.getById("ag1");
    expect(mockDao.findById).toHaveBeenCalledWith("ag1");
  });

  it("create delegates to dao.create", async () => {
    const svc = createAgentsService({} as never);
    const data = { id: "ag1", name: "test-agent" } as never;
    await svc.create(data);
    expect(mockDao.create).toHaveBeenCalledWith(data);
  });

  it("update delegates to dao.update", async () => {
    const svc = createAgentsService({} as never);
    await svc.update("ag1", { name: "updated" } as never);
    expect(mockDao.update).toHaveBeenCalledWith("ag1", { name: "updated" });
  });

  it("delete delegates to dao.delete", async () => {
    const svc = createAgentsService({} as never);
    await svc.delete("ag1");
    expect(mockDao.delete).toHaveBeenCalledWith("ag1");
  });
});
