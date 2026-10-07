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
  it("reads all routines and wraps meta", async () => {
    const svc = makeService();
    const all = await svc.getAll();
    expect(all[0]).toMatchObject({ id: "routine-1", meta: { createdAt: now, updatedAt: now } });
  });
});
