import { describe, it, expect, vi } from "vitest";
import { createJobsService } from "./createJobsService";

const makeMockDao = () => ({
  findMany: vi.fn().mockResolvedValue([{ id: "j1" }]),
  findById: vi.fn().mockResolvedValue({ id: "j1" }),
  create: vi.fn().mockResolvedValue({ id: "j1" }),
  updateStatus: vi.fn().mockResolvedValue({ id: "j1" }),
  delete: vi.fn().mockResolvedValue(undefined),
});

const makeMockTracesDao = () => ({
  findByJobId: vi.fn().mockResolvedValue([{ id: "t1", jobId: "j1" }]),
});

describe("createJobsService", () => {
  it("getAll delegates to dao.findMany", async () => {
    const dao = makeMockDao();
    const tracesDao = makeMockTracesDao();
    const svc = createJobsService(dao as never, tracesDao as never);
    await svc.getAll();
    expect(dao.findMany).toHaveBeenCalled();
  });

  it("getById delegates to dao.findById", async () => {
    const dao = makeMockDao();
    const tracesDao = makeMockTracesDao();
    const svc = createJobsService(dao as never, tracesDao as never);
    await svc.getById("j1");
    expect(dao.findById).toHaveBeenCalledWith("j1");
  });

  it("create delegates to dao.create", async () => {
    const dao = makeMockDao();
    const tracesDao = makeMockTracesDao();
    const svc = createJobsService(dao as never, tracesDao as never);
    const data = { pipelineId: "p1" } as never;
    await svc.create(data);
    expect(dao.create).toHaveBeenCalledWith(data);
  });

  it("updateStatus delegates to dao.updateStatus", async () => {
    const dao = makeMockDao();
    const tracesDao = makeMockTracesDao();
    const svc = createJobsService(dao as never, tracesDao as never);
    await svc.updateStatus("j1", "completed" as never);
    expect(dao.updateStatus).toHaveBeenCalledWith("j1", "completed");
  });

  it("delete delegates to dao.delete", async () => {
    const dao = makeMockDao();
    const tracesDao = makeMockTracesDao();
    const svc = createJobsService(dao as never, tracesDao as never);
    await svc.delete("j1");
    expect(dao.delete).toHaveBeenCalledWith("j1");
  });

  it("getTracesByJobId delegates to jobTracesDao", async () => {
    const dao = makeMockDao();
    const tracesDao = makeMockTracesDao();
    const svc = createJobsService(dao as never, tracesDao as never);
    await svc.getTracesByJobId("j1");
    expect(tracesDao.findByJobId).toHaveBeenCalledWith("j1");
  });
});
