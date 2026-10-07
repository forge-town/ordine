import { describe, expect, it, vi } from "vitest";
const storedResult: unknown[] = [];
const operation = vi.fn().mockResolvedValue(storedResult);
vi.mock("@repo/models", () => ({
  createJobsDao: () => ({}),
  createJobTracesDao: () => ({}),
  createAgentRawExportsDao: () => ({}),
  createAgentSpansDao: () => ({ findByRawExportId: operation }),
}));
import { createJobsService } from "../../jobs.service";
describe("getSpansByRawExportId", () => {
  it("returns the stored job-related result without changing its public shape", async () => {
    const service = createJobsService({} as never);
    const result = await service.getSpansByRawExportId(7);
    expect(result).toEqual(storedResult);
  });
  it("preserves persistence failures for the caller", async () => {
    const error = new Error("storage unavailable");
    operation.mockRejectedValueOnce(error);
    const service = createJobsService({} as never);
    await expect(service.getSpansByRawExportId(7)).rejects.toBe(error);
  });
});
