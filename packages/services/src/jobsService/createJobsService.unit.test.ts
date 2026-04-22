import { describe, it, expect, vi } from "vitest";
import type { DbConnection } from "@repo/models";

const mockJobsDao = {
  findMany: vi.fn().mockResolvedValue([{ id: "j1" }]),
  findById: vi.fn().mockResolvedValue({ id: "j1" }),
  create: vi.fn().mockResolvedValue({ id: "j1" }),
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

// @ts-expect-error -- DAO is mocked, db parameter unused at runtime
const mockDb: DbConnection = {};

describe("createJobsService", () => {
  it("getAll delegates to dao.findMany", async () => {
    const svc = createJobsService(mockDb);
    await svc.getAll();
    expect(mockJobsDao.findMany).toHaveBeenCalled();
  });

  it("getById delegates to dao.findById", async () => {
    const svc = createJobsService(mockDb);
    await svc.getById("j1");
    expect(mockJobsDao.findById).toHaveBeenCalledWith("j1");
  });

  it("create delegates to dao.create", async () => {
    const svc = createJobsService(mockDb);
    const data = { pipelineId: "p1" } as Parameters<typeof svc.create>[0];
    await svc.create(data);
    expect(mockJobsDao.create).toHaveBeenCalledWith(data);
  });

  it("updateStatus delegates to dao.updateStatus", async () => {
    const svc = createJobsService(mockDb);
    await svc.updateStatus("j1", "completed" as Parameters<typeof svc.updateStatus>[1]);
    expect(mockJobsDao.updateStatus).toHaveBeenCalledWith("j1", "completed");
  });

  it("delete delegates to dao.delete", async () => {
    const svc = createJobsService(mockDb);
    await svc.delete("j1");
    expect(mockJobsDao.delete).toHaveBeenCalledWith("j1");
  });

  it("getTracesByJobId delegates to jobTracesDao", async () => {
    const svc = createJobsService(mockDb);
    await svc.getTracesByJobId("j1");
    expect(mockTracesDao.findByJobId).toHaveBeenCalledWith("j1");
  });
});
