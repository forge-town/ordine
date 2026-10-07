import { beforeEach, describe, it, expect, vi } from "vitest";

const mockDao = {
  findMany: vi
    .fn()
    .mockResolvedValue([{ id: "o1", createdAt: new Date(0), updatedAt: new Date(0) }]),
  findById: vi.fn().mockResolvedValue({ id: "o1", createdAt: new Date(0), updatedAt: new Date(0) }),
  create: vi.fn().mockResolvedValue({ id: "o1", createdAt: new Date(0), updatedAt: new Date(0) }),
  update: vi.fn().mockResolvedValue({ id: "o1", createdAt: new Date(0), updatedAt: new Date(0) }),
  delete: vi.fn().mockResolvedValue(undefined),
};
const mockPipelinesDao = {
  findMany: vi.fn().mockResolvedValue([]),
};

vi.mock("@repo/models", () => ({
  createCapabilityRiskOverridesDao: () => ({ findMany: vi.fn().mockResolvedValue([]) }),
  createConnectorsDao: () => ({ findMany: vi.fn().mockResolvedValue([]) }),
  createOperationsDao: () => mockDao,
  createPipelinesDao: () => mockPipelinesDao,
  createOperationRegistryRepository: () => ({
    runSerializable: async (callback: (transaction: unknown) => Promise<unknown>) =>
      callback({ operationsDao: mockDao, pipelinesDao: mockPipelinesDao }),
  }),
  createSkillsDao: () => ({
    findMany: vi.fn().mockResolvedValue([]),
    seedIfEmpty: vi.fn().mockResolvedValue(undefined),
  }),
}));

import { createOperationsService } from "../../operations.service";

describe("createOperationsService", () => {
  beforeEach(() => {
    mockDao.delete.mockClear();
    mockPipelinesDao.findMany.mockReset();
    mockPipelinesDao.findMany.mockResolvedValue([]);
  });
  it("getById delegates to dao.findById", async () => {
    const svc = createOperationsService({} as never);
    await svc.getById("o1");
    expect(mockDao.findById).toHaveBeenCalledWith("o1");
  });
});
