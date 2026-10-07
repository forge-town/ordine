import { describe, expect, it } from "vitest";
import { terminalStatusForAbort } from "./terminalStatusForAbort.helper";

describe("terminalStatusForAbort", () => {
  it("retains the Agent Run boundary contract", () => {
    expect(terminalStatusForAbort("first_output_timeout")).toBe("timed_out");
    expect(terminalStatusForAbort("user_cancel")).toBe("cancelled");
  });
});
