import { describe, it, expect, vi } from "vitest";

const mockDao = {
  findMany: vi.fn().mockResolvedValue([{ id: "p1" }]),
  findById: vi.fn().mockResolvedValue({ id: "p1" }),
  create: vi.fn().mockResolvedValue({ id: "p1" }),
  update: vi.fn().mockResolvedValue({ id: "p1" }),
  delete: vi.fn().mockResolvedValue(undefined),
};

vi.mock("@repo/models", () => ({
  createPipelinesDao: () => mockDao,
}));

import { createPipelinesService } from "./createPipelinesService";
import type { DbConnection } from "@repo/models";

// @ts-expect-error -- DAO is mocked, db parameter unused at runtime
const mockDb: DbConnection = {};

describe("createPipelinesService", () => {
  it("getAll delegates to dao.findMany", async () => {
    const svc = createPipelinesService(mockDb);
    const result = await svc.getAll();
    expect(mockDao.findMany).toHaveBeenCalled();
    expect(result).toEqual([{ id: "p1" }]);
  });

  it("getById delegates to dao.findById", async () => {
    const svc = createPipelinesService(mockDb);
    await svc.getById("p1");
    expect(mockDao.findById).toHaveBeenCalledWith("p1");
  });

  it("create delegates to dao.create", async () => {
    const svc = createPipelinesService(mockDb);
    const data = { name: "pipeline" } as Parameters<typeof svc.create>[0];
    await svc.create(data);
    expect(mockDao.create).toHaveBeenCalledWith(data);
  });

  it("update delegates to dao.update", async () => {
    const svc = createPipelinesService(mockDb);
    await svc.update("p1", { name: "updated" });
    expect(mockDao.update).toHaveBeenCalledWith("p1", { name: "updated" });
  });

  it("delete delegates to dao.delete", async () => {
    const svc = createPipelinesService(mockDb);
    await svc.delete("p1");
    expect(mockDao.delete).toHaveBeenCalledWith("p1");
  });
});
