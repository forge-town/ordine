import { beforeEach, describe, expect, it, vi } from "vitest";
import { logger } from "@repo/logger";
import { loadActiveRun } from "./loadActiveRun";

const mockJobsDao = {
  findById: vi.fn(),
};
const mockJobTracesDao = {
  findByJobId: vi.fn(),
};

vi.mock("@repo/logger", () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

describe("loadActiveRun", () => {
  beforeEach(() => {
    mockJobsDao.findById.mockReset();
    mockJobTracesDao.findByJobId.mockReset();
    vi.mocked(logger.warn).mockClear();
  });

  it("returns undefined when runState is absent", async () => {
    const result = await loadActiveRun(
      { jobsDao: mockJobsDao as never, jobTracesDao: mockJobTracesDao as never },
      undefined,
      "pipe-1",
    );

    expect(result).toBeUndefined();
    expect(mockJobsDao.findById).not.toHaveBeenCalled();
  });

  it("returns undefined when the job does not exist", async () => {
    mockJobsDao.findById.mockResolvedValue(undefined);

    const result = await loadActiveRun(
      { jobsDao: mockJobsDao as never, jobTracesDao: mockJobTracesDao as never },
      { jobId: "job-1", nodeStatuses: {}, status: "running" },
      "pipe-1",
    );

    expect(result).toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(
      { jobId: "job-1" },
      "proposeActions: runState job not found",
    );
  });

  it("returns undefined when the job belongs to a different pipeline", async () => {
    mockJobsDao.findById.mockResolvedValue({
      id: "job-1",
      pipelineId: "pipe-other",
      status: "running",
    });

    const result = await loadActiveRun(
      { jobsDao: mockJobsDao as never, jobTracesDao: mockJobTracesDao as never },
      { jobId: "job-1", nodeStatuses: {}, status: "running" },
      "pipe-1",
    );

    expect(result).toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(
      { jobId: "job-1", jobPipelineId: "pipe-other", pipelineId: "pipe-1" },
      "proposeActions: runState job does not belong to current pipeline",
    );
    expect(mockJobTracesDao.findByJobId).not.toHaveBeenCalled();
  });

  it("returns undefined when pipelineId is not provided", async () => {
    mockJobsDao.findById.mockResolvedValue({
      id: "job-1",
      pipelineId: "pipe-1",
      status: "running",
    });

    const result = await loadActiveRun(
      { jobsDao: mockJobsDao as never, jobTracesDao: mockJobTracesDao as never },
      { jobId: "job-1", nodeStatuses: {}, status: "running" },
      undefined,
    );

    expect(result).toBeUndefined();
    expect(mockJobTracesDao.findByJobId).not.toHaveBeenCalled();
  });

  it("returns active run with chronological traces when the job belongs to the current pipeline", async () => {
    mockJobsDao.findById.mockResolvedValue({
      id: "job-1",
      pipelineId: "pipe-1",
      status: "running",
    });
    mockJobTracesDao.findByJobId.mockResolvedValue([
      { level: "info", message: "latest" },
      { level: "warn", message: "earlier" },
    ]);

    const result = await loadActiveRun(
      { jobsDao: mockJobsDao as never, jobTracesDao: mockJobTracesDao as never },
      { jobId: "job-1", nodeStatuses: { n1: "done" }, status: "running" },
      "pipe-1",
    );

    expect(result).toEqual({
      jobId: "job-1",
      jobStatus: "running",
      nodeStatuses: { n1: "done" },
      traces: [
        { level: "warn", message: "earlier" },
        { level: "info", message: "latest" },
      ],
    });
  });
});
