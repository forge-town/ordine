import { describe, expect, it } from "vitest";
import { createRunControlGetStateHelper } from "./runControlGetState.helper";
describe("runControlGetState", () => {
  it("retains the runner data and state boundary", () => {
    const states = new Map();
    const get = createRunControlGetStateHelper({ states });
    const first = get("job-1");
    expect(get("job-1")).toBe(first);
    expect(get("job-2").abortController).not.toBe(first.abortController);
  });
});
