import { ok } from "neverthrow";
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

import { createRoutinesService } from "../../routines.service";

const startRun = vi.fn().mockResolvedValue(ok({ jobId: "job-1" }));
const makeService = () => createRoutinesService({} as never, { startRun });

describe("createRoutinesService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDao.findById.mockResolvedValue(storedRoutine);
    startRun.mockResolvedValue(ok({ jobId: "job-1" }));
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
});
