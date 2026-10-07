import { describe, expect, it, vi } from "vitest";
import { waitForJobCompletion } from "./waitForJobCompletion.helper";
describe("waitForJobCompletion", () => {
  it("retains terminal success and provider failure outcomes", async () => {
    const findById = vi
      .fn()
      .mockResolvedValueOnce({ status: "done" })
      .mockResolvedValueOnce({ status: "failed", error: "provider failed" })
      .mockResolvedValueOnce(undefined);
    const dao = { findById } as never;
    expect(await waitForJobCompletion(dao, "job-1")).toEqual({ status: "completed" });
    expect(await waitForJobCompletion(dao, "job-1")).toEqual({
      status: "failed",
      error: "provider failed",
    });
    expect(await waitForJobCompletion(dao, "job-1")).toEqual({
      status: "failed",
      error: "Job not found",
    });
  });
});
