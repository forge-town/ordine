import { describe, it, expect, vi } from "vitest";

const mockDao = {
  findMany: vi.fn().mockResolvedValue([{ id: "g1" , createdAt: new Date(0), updatedAt: new Date(0) }]),
  findById: vi.fn().mockResolvedValue({ id: "g1" , createdAt: new Date(0), updatedAt: new Date(0) }),
  create: vi.fn().mockResolvedValue({ id: "g1" , createdAt: new Date(0), updatedAt: new Date(0) }),
  update: vi.fn().mockResolvedValue({ id: "g1" , createdAt: new Date(0), updatedAt: new Date(0) }),
  delete: vi.fn().mockResolvedValue(undefined),
};

vi.mock("@repo/models", () => ({
  createGithubProjectsDao: () => mockDao,
}));

import { createGithubProjectsService } from "./createGithubProjectsService";

describe("createGithubProjectsService", () => {
  it("getAll delegates to dao.findMany", async () => {
    const svc = createGithubProjectsService({} as never);
    const result = await svc.getAll();
    expect(mockDao.findMany).toHaveBeenCalled();
    expect(result).toEqual([{ id: "g1" , meta: { createdAt: new Date(0), updatedAt: new Date(0) } }]);
  });

  it("getById delegates to dao.findById", async () => {
    const svc = createGithubProjectsService({} as never);
    await svc.getById("g1");
    expect(mockDao.findById).toHaveBeenCalledWith("g1");
  });

  it("create delegates to dao.create", async () => {
    const svc = createGithubProjectsService({} as never);
    const data = { name: "repo" } as never;
    await svc.create(data);
    expect(mockDao.create).toHaveBeenCalledWith(data);
  });

  it("update delegates to dao.update", async () => {
    const svc = createGithubProjectsService({} as never);
    await svc.update("g1", { name: "new" } as never);
    expect(mockDao.update).toHaveBeenCalledWith("g1", { name: "new" });
  });

  it("delete delegates to dao.delete", async () => {
    const svc = createGithubProjectsService({} as never);
    await svc.delete("g1");
    expect(mockDao.delete).toHaveBeenCalledWith("g1");
  });
});
