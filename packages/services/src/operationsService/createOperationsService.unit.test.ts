import { beforeEach, describe, it, expect, vi } from "vitest";
import { ok } from "neverthrow";

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

import { createOperationsService } from "./createOperationsService";

describe("createOperationsService", () => {
  beforeEach(() => {
    mockDao.delete.mockClear();
    mockPipelinesDao.findMany.mockReset();
    mockPipelinesDao.findMany.mockResolvedValue([]);
  });

  it("getAll delegates to dao.findMany", async () => {
    const svc = createOperationsService({} as never);
    const result = await svc.getAll();
    expect(mockDao.findMany).toHaveBeenCalled();
    expect(result).toEqual([
      { id: "o1", meta: { createdAt: new Date(0), updatedAt: new Date(0) } },
    ]);
  });

  it("getById delegates to dao.findById", async () => {
    const svc = createOperationsService({} as never);
    await svc.getById("o1");
    expect(mockDao.findById).toHaveBeenCalledWith("o1");
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

  it("update delegates to dao.update", async () => {
    const svc = createOperationsService({} as never);
    await svc.update("o1", { name: "updated" } as never);
    expect(mockDao.update).toHaveBeenCalledWith("o1", { name: "updated" });
  });

  it("delete delegates to dao.delete", async () => {
    const svc = createOperationsService({} as never);
    const result = await svc.delete("o1");

    expect(result).toEqual(ok(undefined));
    expect(mockDao.delete).toHaveBeenCalledWith("o1");
  });

  it("rejects deleting an Operation referenced by a saved Pipeline", async () => {
    mockPipelinesDao.findMany.mockResolvedValueOnce([
      {
        id: "pipeline-1",
        nodes: [
          {
            id: "operation-node",
            data: { nodeType: "operation", operationId: "o1" },
          },
        ],
      },
    ]);
    const svc = createOperationsService({} as never);

    const result = await svc.delete("o1");

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toMatchObject({
        name: "OperationInUseConflictError",
        code: "OPERATION_IN_USE",
        operationId: "o1",
        pipelineIds: ["pipeline-1"],
      });
    }
    expect(mockDao.delete).not.toHaveBeenCalled();
  });
});
