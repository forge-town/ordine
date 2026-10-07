import { describe, it, expect, vi } from "vitest";

const mockJobsDao = {
  findMany: vi
    .fn()
    .mockResolvedValue([{ id: "j1", createdAt: new Date(0), updatedAt: new Date(0) }]),
  findById: vi.fn().mockResolvedValue({ id: "j1", createdAt: new Date(0), updatedAt: new Date(0) }),
  create: vi.fn().mockResolvedValue({ id: "j1", createdAt: new Date(0), updatedAt: new Date(0) }),
  updateStatus: vi.fn().mockResolvedValue({ id: "j1" }),
  delete: vi.fn().mockResolvedValue(undefined),
};

const mockTracesDao = {
  findByJobId: vi.fn().mockResolvedValue([{ id: "t1", jobId: "j1" }]),
};

const mockAgentRawExportsDao = {
  findByJobId: vi.fn().mockResolvedValue([]),
  findById: vi.fn().mockResolvedValue(null),
};

const mockAgentSpansDao = {
  findByJobId: vi.fn().mockResolvedValue([]),
  findByRawExportId: vi.fn().mockResolvedValue([]),
};

vi.mock("@repo/models", () => ({
  createJobsDao: () => mockJobsDao,
  createJobTracesDao: () => mockTracesDao,
  createAgentRawExportsDao: () => mockAgentRawExportsDao,
  createAgentSpansDao: () => mockAgentSpansDao,
}));

import { createJobsService } from "../../jobs.service";

describe("createJobsService", () => {
  it("create delegates to dao.create", async () => {
    const svc = createJobsService({} as never);
    const data = { pipelineId: "p1" } as never;
    await svc.create(data);
    expect(mockJobsDao.create).toHaveBeenCalledWith(data);
  });
});
