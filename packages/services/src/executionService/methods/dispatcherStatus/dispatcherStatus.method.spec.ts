import { describe, expect, it } from "vitest";
import { createDispatcherStatusMethod } from "./dispatcherStatus.method";

describe("dispatcherStatus", () => {
  it("reports active dispatcher state", () => {
    const controller = new AbortController();
    const state = { accepting: true, started: true };
    const active = new Map([["job", { controller, task: Promise.resolve() }]]);
    expect(createDispatcherStatusMethod({ state, active })()).toMatchObject({
      accepting: true,
      activeJobs: ["job"],
    });
  });
});
