import { describe, expect, it, vi } from "vitest";

const mockDao = {
  findMany: vi.fn().mockResolvedValue([{ id: "dst-1", createdAt: new Date(0), updatedAt: new Date(0) }]),
  findById: vi.fn().mockResolvedValue({ id: "dst-1", createdAt: new Date(0), updatedAt: new Date(0) }),
  create: vi.fn().mockResolvedValue({ id: "dst-1", createdAt: new Date(0), updatedAt: new Date(0) }),
  update: vi.fn().mockResolvedValue({ id: "dst-1", createdAt: new Date(0), updatedAt: new Date(0) }),
  delete: vi.fn().mockResolvedValue(undefined),
};

vi.mock("@repo/models", () => ({
  createDistillationsDao: () => mockDao,
}));

import { createDistillationsService } from "./createDistillationsService";
import type { DbConnection } from "@repo/models";

// @ts-expect-error -- DAO is mocked in tests
const mockDb: DbConnection = {};

describe("createDistillationsService", () => {
  it("getAll delegates to dao.findMany", async () => {
    const svc = createDistillationsService(mockDb);
    const result = await svc.getAll();

    expect(mockDao.findMany).toHaveBeenCalled();
    expect(result).toEqual([{ id: "dst-1", meta: { createdAt: new Date(0), updatedAt: new Date(0) } }]);
  });

  it("getById delegates to dao.findById", async () => {
    const svc = createDistillationsService(mockDb);

    await svc.getById("dst-1");

    expect(mockDao.findById).toHaveBeenCalledWith("dst-1");
  });

  it("create delegates to dao.create", async () => {
    const svc = createDistillationsService(mockDb);
    const data = { title: "Draft" } as Parameters<typeof svc.create>[0];

    await svc.create(data);

    expect(mockDao.create).toHaveBeenCalledWith(data);
  });

  it("update delegates to dao.update", async () => {
    const svc = createDistillationsService(mockDb);

    await svc.update("dst-1", { status: "completed" });

    expect(mockDao.update).toHaveBeenCalledWith("dst-1", { status: "completed" });
  });

  it("delete delegates to dao.delete", async () => {
    const svc = createDistillationsService(mockDb);

    await svc.delete("dst-1");

    expect(mockDao.delete).toHaveBeenCalledWith("dst-1");
  });
});
