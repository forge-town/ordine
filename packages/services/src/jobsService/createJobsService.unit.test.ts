import { describe, it, expect, vi } from "vitest";

const mockJobsDao = {
  findMany: vi.fn().mockResolvedValue([{ id: "j1", createdAt: new Date(0), updatedAt: new Date(0) }]),
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

import { createJobsService } from "./createJobsService";

describe("createJobsService", () => {
  it("getAll delegates to dao.findMany", async () => {
    const svc = createJobsService({} as never);
    await svc.getAll();
    expect(mockJobsDao.findMany).toHaveBeenCalled();
  });

  it("getById delegates to dao.findById", async () => {
    const svc = createJobsService({} as never);
    await svc.getById("j1");
    expect(mockJobsDao.findById).toHaveBeenCalledWith("j1");
  });

  it("create delegates to dao.create", async () => {
    const svc = createJobsService({} as never);
    const data = { pipelineId: "p1" } as never;
    await svc.create(data);
    expect(mockJobsDao.create).toHaveBeenCalledWith(data);
  });

  it("updateStatus delegates to dao.updateStatus", async () => {
    const svc = createJobsService({} as never);
    await svc.updateStatus("j1", "completed" as never);
    expect(mockJobsDao.updateStatus).toHaveBeenCalledWith("j1", "completed");
  });

  it("delete delegates to dao.delete", async () => {
    const svc = createJobsService({} as never);
    await svc.delete("j1");
    expect(mockJobsDao.delete).toHaveBeenCalledWith("j1");
  });

  it("getTracesByJobId delegates to jobTracesDao", async () => {
    const svc = createJobsService({} as never);
    await svc.getTracesByJobId("j1");
    expect(mockTracesDao.findByJobId).toHaveBeenCalledWith("j1");
  });
});
