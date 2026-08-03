import { describe, expect, it } from "vitest";
import { isValidAgentApiToken } from "../src/integrations/auth/agentApiAuth";

describe("isValidAgentApiToken", () => {
  const expectedToken = "a".repeat(32);

  it("accepts an exact bearer token", () => {
    expect(isValidAgentApiToken(`Bearer ${expectedToken}`, expectedToken)).toBe(true);
  });

  it.each([
    undefined,
    expectedToken,
    "Basic credentials",
    `Bearer ${"b".repeat(32)}`,
    `Bearer ${expectedToken}extra`,
  ])("rejects invalid authorization value %s", (authorization) => {
    expect(isValidAgentApiToken(authorization, expectedToken)).toBe(false);
  });
});
