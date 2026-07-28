import { err, ok } from "neverthrow";
import { describe, expect, it, vi, beforeEach } from "vitest";

const now = new Date("2026-06-10T09:00:00.000Z");
const storedRoutine = {
  id: "routine-1",
  pipelineId: "pipe-1",
  name: "Morning run",
  description: "Daily briefing",
  cronExpression: "*/5 * * * *",
  inputConfig: { prompt: "daily brief", ignored: 42 },
  enabled: true,
  lastRunAt: null,
  nextRunAt: null,
  createdAt: now,
  updatedAt: now,
};

const mockDao = {
  findMany: vi.fn().mockResolvedValue([storedRoutine]),
  findById: vi.fn().mockResolvedValue(storedRoutine),
  findManyByPipelineId: vi.fn().mockResolvedValue([storedRoutine]),
  findManyEnabled: vi.fn().mockResolvedValue([storedRoutine]),
  create: vi.fn().mockResolvedValue(storedRoutine),
  update: vi.fn().mockResolvedValue(storedRoutine),
  delete: vi.fn().mockResolvedValue(undefined),
};

vi.mock("@repo/models", () => ({
  createRoutinesDao: () => mockDao,
}));

import { createRoutinesService } from "./createRoutinesService";

const startRun = vi.fn().mockResolvedValue(ok({ jobId: "job-1" }));
const makeService = () => createRoutinesService({} as never, { startRun });

describe("createRoutinesService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDao.findById.mockResolvedValue(storedRoutine);
    startRun.mockResolvedValue(ok({ jobId: "job-1" }));
  });

  it("reads delegate to the dao and wrap meta", async () => {
    const svc = makeService();
    const all = await svc.getAll();
    expect(all[0]).toMatchObject({ id: "routine-1", meta: { createdAt: now, updatedAt: now } });
    await svc.getById("routine-1");
    expect(mockDao.findById).toHaveBeenCalledWith("routine-1");
    await svc.getByPipelineId("pipe-1");
    expect(mockDao.findManyByPipelineId).toHaveBeenCalledWith("pipe-1");
    await svc.getEnabled();
    expect(mockDao.findManyEnabled).toHaveBeenCalled();
    await svc.delete("routine-1");
    expect(mockDao.delete).toHaveBeenCalledWith("routine-1");
  });

  it("create computes nextRunAt from the cron expression", async () => {
    const svc = makeService();
    const result = await svc.create({
      id: "routine-1",
      pipelineId: "pipe-1",
      name: "Morning run",
      description: "Daily briefing",
      cronExpression: "*/5 * * * *",
    });
    expect(result.isOk()).toBe(true);
    const payload = mockDao.create.mock.calls[0]![0]!;
    expect(payload.nextRunAt).toBeInstanceOf(Date);
    expect(payload.nextRunAt!.getMinutes() % 5).toBe(0);
  });

  it("create clears nextRunAt for disabled routines", async () => {
    const svc = makeService();
    const result = await svc.create({
      id: "routine-1",
      pipelineId: "pipe-1",
      name: "Morning run",
      cronExpression: "*/5 * * * *",
      enabled: false,
    });
    expect(result.isOk()).toBe(true);
    expect(mockDao.create.mock.calls[0]![0]!.nextRunAt).toBeNull();
  });

  it("create rejects an enabled routine without a computable schedule", async () => {
    const svc = makeService();
    const missingCron = await svc.create({
      id: "routine-1",
      pipelineId: "pipe-1",
      name: "Morning run",
    });
    expect(missingCron.isErr()).toBe(true);
    const bogusCron = await svc.create({
      id: "routine-1",
      pipelineId: "pipe-1",
      name: "Morning run",
      cronExpression: "bogus",
    });
    expect(bogusCron.isErr()).toBe(true);
    expect(bogusCron._unsafeUnwrapErr().message).toBe(
      "An enabled routine requires a valid cronExpression",
    );
    expect(mockDao.create).not.toHaveBeenCalled();
  });

  it("update recomputes nextRunAt when the schedule changes", async () => {
    const svc = makeService();
    const result = await svc.update("routine-1", { cronExpression: "0 9 * * *" });
    expect(result.isOk()).toBe(true);
    const patch = mockDao.update.mock.calls[0]![1]!;
    expect(patch.nextRunAt).toBeInstanceOf(Date);
  });

  it("update clears nextRunAt when disabling", async () => {
    const svc = makeService();
    const result = await svc.update("routine-1", { enabled: false });
    expect(result.isOk()).toBe(true);
    expect(mockDao.update.mock.calls[0]![1]!.nextRunAt).toBeNull();
  });

  it("update leaves the schedule alone for unrelated patches", async () => {
    const svc = makeService();
    const result = await svc.update("routine-1", { description: "Updated" });
    expect(result.isOk()).toBe(true);
    expect(mockDao.update).toHaveBeenCalledWith("routine-1", { description: "Updated" });
  });

  it("update fails for unknown routines", async () => {
    mockDao.findById.mockResolvedValue(undefined);
    const svc = makeService();
    const result = await svc.update("missing", { description: "x" });
    expect(result.isErr()).toBe(true);
    expect(mockDao.update).not.toHaveBeenCalled();
  });

  it("update accepts a pure enable toggle when the stored cron is valid", async () => {
    const svc = makeService();
    const result = await svc.update("routine-1", { enabled: true });
    expect(result.isOk()).toBe(true);
    expect(mockDao.update.mock.calls[0]![1]!.nextRunAt).toBeInstanceOf(Date);
  });

  it("update accepts clearing the cron on a disabled routine", async () => {
    mockDao.findById.mockResolvedValue({ ...storedRoutine, enabled: false });
    const svc = makeService();
    const result = await svc.update("routine-1", { cronExpression: null });
    expect(result.isOk()).toBe(true);
    expect(mockDao.update.mock.calls[0]![1]!.nextRunAt).toBeNull();
  });

  it("update rejects enabling a routine that has no stored cron", async () => {
    mockDao.findById.mockResolvedValue({
      ...storedRoutine,
      enabled: false,
      cronExpression: null,
    });
    const svc = makeService();
    const result = await svc.update("routine-1", { enabled: true });
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().message).toBe(
      "An enabled routine requires a valid cronExpression",
    );
    expect(mockDao.update).not.toHaveBeenCalled();
  });

  it("runNow starts the pipeline as routine-triggered and stamps lastRunAt", async () => {
    const svc = makeService();
    const result = await svc.runNow("routine-1");
    expect(result.isOk()).toBe(true);
    expect(startRun).toHaveBeenCalledWith({
      inputs: { prompt: "daily brief" },
      pipelineId: "pipe-1",
      triggeredBy: "routine",
    });
    expect(mockDao.update).toHaveBeenCalledWith("routine-1", { lastRunAt: expect.any(Date) });
  });

  it("runNow surfaces startRun failures without touching the routine", async () => {
    startRun.mockResolvedValue(err(new Error("pipeline missing")));
    const svc = makeService();
    const result = await svc.runNow("routine-1");
    expect(result.isErr()).toBe(true);
    expect(mockDao.update).not.toHaveBeenCalled();
  });

  it("runNow fails for unknown routines", async () => {
    mockDao.findById.mockResolvedValue(undefined);
    const svc = makeService();
    const result = await svc.runNow("missing");
    expect(result.isErr()).toBe(true);
    expect(startRun).not.toHaveBeenCalled();
  });
});
