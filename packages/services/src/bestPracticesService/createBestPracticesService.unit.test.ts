import { describe, it, expect, vi } from "vitest";
import type { DbConnection } from "@repo/models";

const mockDao = {
  findMany: vi.fn().mockResolvedValue([{ id: "1", title: "BP1" }]),
  findById: vi.fn().mockResolvedValue({ id: "1", title: "BP1" }),
  create: vi.fn().mockResolvedValue({ id: "1" }),
  update: vi.fn().mockResolvedValue({ id: "1" }),
  delete: vi.fn().mockResolvedValue(undefined),
};

vi.mock("@repo/models", () => ({
  createBestPracticesDao: () => mockDao,
}));

import { createBestPracticesService } from "./createBestPracticesService";

// @ts-expect-error -- DAO is mocked, db parameter unused at runtime
const mockDb: DbConnection = {};

describe("createBestPracticesService", () => {
  it("getAll delegates to dao.findMany", async () => {
    const svc = createBestPracticesService(mockDb);
    const result = await svc.getAll();
    expect(mockDao.findMany).toHaveBeenCalled();
    expect(result).toEqual([{ id: "1", title: "BP1" }]);
  });

  it("getById delegates to dao.findById", async () => {
    const svc = createBestPracticesService(mockDb);
    await svc.getById("1");
    expect(mockDao.findById).toHaveBeenCalledWith("1");
  });

  it("create delegates to dao.create", async () => {
    const svc = createBestPracticesService(mockDb);
    const data = { title: "New" } as Parameters<typeof svc.create>[0];
    await svc.create(data);
    expect(mockDao.create).toHaveBeenCalledWith(data);
  });

  it("update delegates to dao.update", async () => {
    const svc = createBestPracticesService(mockDb);
    await svc.update("1", { title: "Updated" });
    expect(mockDao.update).toHaveBeenCalledWith("1", { title: "Updated" });
  });

  it("delete delegates to dao.delete", async () => {
    const svc = createBestPracticesService(mockDb);
    await svc.delete("1");
    expect(mockDao.delete).toHaveBeenCalledWith("1");
  });
});
