import { describe, expect, it, vi, beforeEach } from "vitest";
import { pipelineRunControl } from "../runControl";

const { mockJobsDao } = vi.hoisted(() => ({
  mockJobsDao: {
    findById: vi.fn(),
    updateStatus: vi.fn().mockResolvedValue(undefined),
    create: vi.fn().mockResolvedValue(undefined),
    setNodeStatuses: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("@repo/obs", () => ({
  initObs: vi.fn(),
  initSpanRecorder: vi.fn(),
  trace: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@repo/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock("@repo/models", () => ({
  createAgentsDao: vi.fn(() => ({})),
  createOperationsDao: vi.fn(() => ({})),
  createPipelinesDao: vi.fn(() => ({ findById: vi.fn() })),
  createJobsDao: vi.fn(() => mockJobsDao),
  createJobTracesDao: vi.fn(() => ({})),
  createSkillsDao: vi.fn(() => ({})),
  createAgentRawExportsDao: vi.fn(() => ({})),
  createAgentSpansDao: vi.fn(() => ({})),
  createSettingsDao: vi.fn(() => ({ get: vi.fn().mockResolvedValue({}) })),
  createPipelineRunsDao: vi.fn(() => ({})),
  createAgentRuntimesDao: vi.fn(() => ({ findMany: vi.fn().mockResolvedValue([]) })),
}));

import type { DbConnection } from "@repo/models";
import {
  createPipelineRunnerService,
  JobNotFoundError,
  InvalidJobStatusError,
} from "./createPipelineRunnerService";

const makeService = () => createPipelineRunnerService({} as DbConnection);

describe("createPipelineRunnerService run controls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockJobsDao.updateStatus.mockResolvedValue(undefined);
  });

  it("resumeRun releases a checkpoint waiter while the job status is still running", async () => {
    const jobId = "job-checkpoint";
    mockJobsDao.findById.mockResolvedValue({ id: jobId, status: "running" });
    const service = makeService();

    // The engine suspends on a checkpoint node; the job status stays "running".
    const control = pipelineRunControl.buildForJob(jobId);
    let released = false;
    const waiting = control
      .waitForResume?.({ jobId, nodeId: "n1", reason: "checkpoint" })
      .then(() => {
        released = true;
      });
    expect(released).toBe(false);

    const result = await service.resumeRun(jobId);
    await waiting;

    expect(result.isOk()).toBe(true);
    expect(released).toBe(true);
    expect(mockJobsDao.updateStatus).toHaveBeenCalledWith(jobId, "running", undefined);

    pipelineRunControl.clear(jobId);
  });

  it("resumeRun still works for a paused job", async () => {
    const jobId = "job-paused-resume";
    mockJobsDao.findById.mockResolvedValue({ id: jobId, status: "paused" });
    const service = makeService();

    const result = await service.resumeRun(jobId);

    expect(result.isOk()).toBe(true);
    expect(mockJobsDao.updateStatus).toHaveBeenCalledWith(jobId, "running", undefined);

    pipelineRunControl.clear(jobId);
  });

  it("resumeRun rejects terminal jobs", async () => {
    mockJobsDao.findById.mockResolvedValue({ id: "job-done", status: "done" });
    const service = makeService();

    const result = await service.resumeRun("job-done");

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(InvalidJobStatusError);
    }
    expect(mockJobsDao.updateStatus).not.toHaveBeenCalled();
  });

  it("resumeRun rejects unknown jobs", async () => {
    mockJobsDao.findById.mockResolvedValue(undefined);
    const service = makeService();

    const result = await service.resumeRun("job-missing");

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(JobNotFoundError);
    }
  });

  it("cancelRun cancels a queued job", async () => {
    const jobId = "job-queued-cancel";
    mockJobsDao.findById.mockResolvedValue({ id: jobId, status: "queued" });
    const service = makeService();

    const result = await service.cancelRun(jobId);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toEqual({ jobId, cancelled: true });
    }
    expect(mockJobsDao.updateStatus).toHaveBeenCalledWith(
      jobId,
      "cancelled",
      expect.objectContaining({ finishedAt: expect.any(Date) }),
    );

    pipelineRunControl.clear(jobId);
  });

  it("pauseRun rejects a queued job (pause only applies to running jobs)", async () => {
    mockJobsDao.findById.mockResolvedValue({ id: "job-q", status: "queued" });
    const service = makeService();

    const result = await service.pauseRun("job-q");

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(InvalidJobStatusError);
    }
    expect(mockJobsDao.updateStatus).not.toHaveBeenCalled();
  });

  it("surfaces a DB write failure as an error result", async () => {
    mockJobsDao.findById.mockResolvedValue({ id: "job-db", status: "running" });
    mockJobsDao.updateStatus.mockRejectedValueOnce(new Error("DB down"));
    const service = makeService();

    const result = await service.pauseRun("job-db");

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toContain("DB down");
    }
  });
});
