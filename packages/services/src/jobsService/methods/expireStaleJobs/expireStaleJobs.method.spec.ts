import { describe, expect, it, vi } from "vitest";
const storedResult = [{ id: "j1", status: "expired" }];
const operation = vi.fn().mockResolvedValue(storedResult);
vi.mock("@repo/models", () => ({
  createJobsDao: () => ({ expireStaleJobs: operation }),
  createJobTracesDao: () => ({}),
  createAgentRawExportsDao: () => ({}),
  createAgentSpansDao: () => ({}),
}));
import { createJobsService } from "../../jobs.service";
describe("expireStaleJobs", () => {
  it("returns the stored job-related result without changing its public shape", async () => {
    const service = createJobsService({} as never);
    const result = await service.expireStaleJobs({
      observedAt: new Date(0),
      queuedTimeoutMs: 60_000,
      legacyNoLeaseTimeoutMs: 120_000,
      sweeperId: "test-sweeper",
    });
    expect(result).toEqual(storedResult);
  });
  it("preserves persistence failures for the caller", async () => {
    const error = new Error("storage unavailable");
    operation.mockRejectedValueOnce(error);
    const service = createJobsService({} as never);
    await expect(
      service.expireStaleJobs({
        observedAt: new Date(0),
        queuedTimeoutMs: 60_000,
        legacyNoLeaseTimeoutMs: 120_000,
        sweeperId: "test-sweeper",
      }),
    ).rejects.toBe(error);
  });
});
