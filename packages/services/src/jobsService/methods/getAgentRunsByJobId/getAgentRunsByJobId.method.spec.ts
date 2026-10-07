import { describe, expect, it, vi } from "vitest";
const storedResult = [{ id: 7, jobId: "j1", status: "completed" }];
const operation = vi.fn().mockResolvedValue(storedResult);
vi.mock("@repo/models", () => ({
  createJobsDao: () => ({}),
  createJobTracesDao: () => ({}),
  createAgentRawExportsDao: () => ({ findByJobId: operation }),
  createAgentSpansDao: () => ({}),
}));
import { createJobsService } from "../../jobs.service";
describe("getAgentRunsByJobId", () => {
  it("returns the stored job-related result without changing its public shape", async () => {
    const service = createJobsService({} as never);
    const result = await service.getAgentRunsByJobId("j1");
    expect(result).toEqual(storedResult);
  });
  it("preserves persistence failures for the caller", async () => {
    const error = new Error("storage unavailable");
    operation.mockRejectedValueOnce(error);
    const service = createJobsService({} as never);
    await expect(service.getAgentRunsByJobId("j1")).rejects.toBe(error);
  });
});
