import { describe, it, expect, vi } from "vitest";

const mockDao = {
  findMany: vi
    .fn()
    .mockResolvedValue([{ id: "ag1", createdAt: new Date(0), updatedAt: new Date(0) }]),
  findById: vi
    .fn()
    .mockResolvedValue({ id: "ag1", createdAt: new Date(0), updatedAt: new Date(0) }),
  create: vi.fn().mockResolvedValue({ id: "ag1", createdAt: new Date(0), updatedAt: new Date(0) }),
  update: vi.fn().mockResolvedValue({ id: "ag1", createdAt: new Date(0), updatedAt: new Date(0) }),
  delete: vi.fn().mockResolvedValue(undefined),
};

vi.mock("@repo/models", () => ({
  createAgentsDao: () => mockDao,
}));

import { createAgentsService } from "../../agents.service";

describe("createAgentsService", () => {
  it("delete delegates to dao.delete", async () => {
    const svc = createAgentsService({} as never);
    await svc.delete("ag1");
    expect(mockDao.delete).toHaveBeenCalledWith("ag1");
  });
});
