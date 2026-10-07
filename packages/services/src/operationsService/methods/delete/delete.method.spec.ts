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

import { createOperationsService } from "../../operations.service";

describe("createOperationsService", () => {
  beforeEach(() => {
    mockDao.delete.mockClear();
    mockPipelinesDao.findMany.mockReset();
    mockPipelinesDao.findMany.mockResolvedValue([]);
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
