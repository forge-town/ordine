import { describe, expect, it } from "vitest";
import { abortError } from "./abortError.helper";

describe("abortError", () => {
  it("retains the Agent Run boundary contract", () => {
    expect(abortError("first_output_timeout", 45_000, 60_000)).toMatchObject({
      code: "AGENT_FIRST_OUTPUT_TIMEOUT",
      message: expect.stringContaining("45 seconds"),
    });
    expect(abortError("user_cancel", 0, 0)).toEqual({
      code: "AGENT_RUN_CANCELLED",
      message: "Agent run was cancelled",
    });
  });
});
