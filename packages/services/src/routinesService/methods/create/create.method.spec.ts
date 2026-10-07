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
});
