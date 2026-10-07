import { describe, expect, it, vi } from "vitest";
import type { createJobsDao } from "@repo/models";
vi.mock("@repo/obs", () => ({
  trace: vi.fn().mockRejectedValue(new Error("trace storage unavailable")),
}));
vi.mock("@repo/logger", () => ({ logger: { error: vi.fn() } }));
import { createFailJobSafelyHelper } from "./failJobSafely.helper";
describe("failJobSafely", () => {
  it("preserves a provider failure on an expired job even when error tracing fails", async () => {
    const transitionStatus = vi.fn().mockResolvedValue(null);
    const recordErrorIfExpired = vi.fn().mockResolvedValue(undefined);
    const dao = { transitionStatus, recordErrorIfExpired } as unknown as ReturnType<
      typeof createJobsDao
    >;
    await createFailJobSafelyHelper(dao)("job-1", "provider failed");
    expect(recordErrorIfExpired).toHaveBeenCalledWith("job-1", "provider failed");
  });
  it("does not overwrite an error after successful failure finalization", async () => {
    const transitionStatus = vi.fn().mockResolvedValue({ id: "job-1" });
    const recordErrorIfExpired = vi.fn();
    const dao = { transitionStatus, recordErrorIfExpired } as unknown as ReturnType<
      typeof createJobsDao
    >;
    await createFailJobSafelyHelper(dao)("job-1", "provider failed");
    expect(recordErrorIfExpired).not.toHaveBeenCalled();
  });
});
