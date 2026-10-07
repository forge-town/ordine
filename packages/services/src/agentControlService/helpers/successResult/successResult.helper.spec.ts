import { describe, expect, it } from "vitest";
import { successResult } from "./successResult.helper";

describe("successResult", () => {
  it("retains the Agent Control contract boundary", () => {
    const result = successResult("action-1", {
      resources: [],
      summary: "Done",
      data: { token: "secret-token" },
    });
    expect(result.status).toBe("succeeded");
    expect(JSON.stringify(result.data)).not.toContain("secret-token");
  });
});
