import { describe, expect, it } from "vitest";
import { createWaitForPlanningRunMethod } from "./waitForPlanningRun.method";
describe("waitForPlanningRun", () => {
  it("retains the session persistence boundary", async () => {
    const cause = new Error("projection failed");
    const completion = Promise.reject(cause);
    const wait = createWaitForPlanningRunMethod({
      planningCompletions: new Map([["run-1", completion]]),
    });
    await expect(wait("run-1")).rejects.toBe(cause);
    await expect(wait("unknown")).resolves.toBeUndefined();
  });
});
