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
  it("create delegates to dao.create", async () => {
    const svc = createOperationsService({} as never);
    const data = { name: "op" } as never;
    await svc.create(data);
    expect(mockDao.create).toHaveBeenCalledWith(data);
  });
  it("rejects malformed configs and catalog-missing source skills before insert", async () => {
    const svc = createOperationsService({} as never);
    mockDao.create.mockClear();

    const malformed = await svc.create({
      name: "broken",
      config: { executor: { type: "agent", agent: "not-a-runtime" } },
    } as never);
    expect(malformed._unsafeUnwrapErr()).toMatchObject({
      name: "OperationConfigValidationError",
    });

    const missingSourceSkill = await svc.create({
      name: "broken source",
      config: {},
      sourceSkillId: "missing-skill",
    } as never);
    expect(missingSourceSkill._unsafeUnwrapErr()).toMatchObject({
      name: "CapabilityCatalogValidationError",
      issues: [expect.objectContaining({ path: "sourceSkillId" })],
    });
    expect(mockDao.create).not.toHaveBeenCalled();
  });
});
