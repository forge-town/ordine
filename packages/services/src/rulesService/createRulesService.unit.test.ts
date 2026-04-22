import { describe, it, expect, vi } from "vitest";

const mockDao = {
  findMany: vi.fn().mockResolvedValue([{ id: "ru1" , createdAt: new Date(0), updatedAt: new Date(0) }]),
  findById: vi.fn().mockResolvedValue({ id: "ru1" , createdAt: new Date(0), updatedAt: new Date(0) }),
  create: vi.fn().mockResolvedValue({ id: "ru1" , createdAt: new Date(0), updatedAt: new Date(0) }),
  update: vi.fn().mockResolvedValue({ id: "ru1" , createdAt: new Date(0), updatedAt: new Date(0) }),
  toggleEnabled: vi.fn().mockResolvedValue({ id: "ru1", enabled: false , createdAt: new Date(0), updatedAt: new Date(0) }),
  delete: vi.fn().mockResolvedValue(undefined),
};

vi.mock("@repo/models", () => ({
  createRulesDao: () => mockDao,
}));

import { createRulesService } from "./createRulesService";
import type { DbConnection } from "@repo/models";

// @ts-expect-error -- DAO is mocked, db parameter unused at runtime
const mockDb: DbConnection = {};

describe("createRulesService", () => {
  it("getAll delegates to dao.findMany", async () => {
    const svc = createRulesService(mockDb);
    await svc.getAll();
    expect(mockDao.findMany).toHaveBeenCalled();
  });

  it("getById delegates to dao.findById", async () => {
    const svc = createRulesService(mockDb);
    await svc.getById("ru1");
    expect(mockDao.findById).toHaveBeenCalledWith("ru1");
  });

  it("create delegates to dao.create", async () => {
    const svc = createRulesService(mockDb);
    const data = { name: "rule" } as Parameters<typeof svc.create>[0];
    await svc.create(data);
    expect(mockDao.create).toHaveBeenCalledWith(data);
  });

  it("update delegates to dao.update", async () => {
    const svc = createRulesService(mockDb);
    await svc.update("ru1", { name: "updated" });
    expect(mockDao.update).toHaveBeenCalledWith("ru1", { name: "updated" });
  });

  it("toggleEnabled delegates to dao.toggleEnabled", async () => {
    const svc = createRulesService(mockDb);
    await svc.toggleEnabled("ru1", false);
    expect(mockDao.toggleEnabled).toHaveBeenCalledWith("ru1", false);
  });

  it("delete delegates to dao.delete", async () => {
    const svc = createRulesService(mockDb);
    await svc.delete("ru1");
    expect(mockDao.delete).toHaveBeenCalledWith("ru1");
  });
});
