import { describe, it, expect, vi } from "vitest";

const mockDao = {
  findMany: vi.fn().mockResolvedValue([{ id: "sk1" }]),
  findById: vi.fn().mockResolvedValue({ id: "sk1" }),
  findByName: vi.fn().mockResolvedValue({ id: "sk1", name: "lint" }),
  create: vi.fn().mockResolvedValue({ id: "sk1" }),
  update: vi.fn().mockResolvedValue({ id: "sk1" }),
  delete: vi.fn().mockResolvedValue(undefined),
  seedIfEmpty: vi.fn().mockResolvedValue(undefined),
};

vi.mock("@repo/models", () => ({
  createSkillsDao: () => mockDao,
}));

import { createSkillsService } from "./createSkillsService";
import type { DbConnection } from "@repo/models";

// @ts-expect-error -- DAO is mocked, db parameter unused at runtime
const mockDb: DbConnection = {};

describe("createSkillsService", () => {
  it("getAll delegates to dao.findMany", async () => {
    const svc = createSkillsService(mockDb);
    const result = await svc.getAll();
    expect(mockDao.findMany).toHaveBeenCalled();
    expect(result).toEqual([{ id: "sk1" }]);
  });

  it("getById delegates to dao.findById", async () => {
    const svc = createSkillsService(mockDb);
    await svc.getById("sk1");
    expect(mockDao.findById).toHaveBeenCalledWith("sk1");
  });

  it("getByName delegates to dao.findByName", async () => {
    const svc = createSkillsService(mockDb);
    await svc.getByName("lint");
    expect(mockDao.findByName).toHaveBeenCalledWith("lint");
  });

  it("create delegates to dao.create", async () => {
    const svc = createSkillsService(mockDb);
    const data = { name: "skill" } as Parameters<typeof svc.create>[0];
    await svc.create(data);
    expect(mockDao.create).toHaveBeenCalledWith(data);
  });

  it("update delegates to dao.update", async () => {
    const svc = createSkillsService(mockDb);
    await svc.update("sk1", { name: "updated" });
    expect(mockDao.update).toHaveBeenCalledWith("sk1", { name: "updated" });
  });

  it("delete delegates to dao.delete", async () => {
    const svc = createSkillsService(mockDb);
    await svc.delete("sk1");
    expect(mockDao.delete).toHaveBeenCalledWith("sk1");
  });

  it("seedIfEmpty delegates to dao.seedIfEmpty", async () => {
    const svc = createSkillsService(mockDb);
    await svc.seedIfEmpty();
    expect(mockDao.seedIfEmpty).toHaveBeenCalled();
  });
});
