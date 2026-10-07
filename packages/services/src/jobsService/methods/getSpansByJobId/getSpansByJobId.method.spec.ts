import { describe, expect, it, vi } from "vitest";
const storedResult = [{ id: 8, jobId: "j1", rawExportId: 7 }];
const operation = vi.fn().mockResolvedValue(storedResult);
vi.mock("@repo/models", () => ({
  createJobsDao: () => ({}),
  createJobTracesDao: () => ({}),
  createAgentRawExportsDao: () => ({}),
  createAgentSpansDao: () => ({ findByJobId: operation }),
}));
import { createJobsService } from "../../jobs.service";
describe("getSpansByJobId", () => {
  it("returns the stored job-related result without changing its public shape", async () => {
    const service = createJobsService({} as never);
    const result = await service.getSpansByJobId("j1");
    expect(result).toEqual(storedResult);
  });
  it("preserves persistence failures for the caller", async () => {
    const error = new Error("storage unavailable");
    operation.mockRejectedValueOnce(error);
    const service = createJobsService({} as never);
    await expect(service.getSpansByJobId("j1")).rejects.toBe(error);
  });
});
