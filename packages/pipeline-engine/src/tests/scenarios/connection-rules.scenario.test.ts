import { describe, expect, it } from "vitest";
import { ConnectionRuleSchema, isConnectionAllowed } from "../../schemas/nodes";

/*
Connection rule shapes covered here:

Allowed:
  [folder] ----------> [operation]
  [operation] -------> [output-local-path]

Rejected:
  [output-local-path] -X-> [operation]
*/
describe("pipeline scenario: connection rules", () => {
  it("accepts valid built-in connections used in pipeline scenarios", () => {
    expect(isConnectionAllowed("folder", "operation")).toBe(true);
    expect(
      ConnectionRuleSchema.safeParse({
        sourceType: "operation",
        targetType: "output-local-path",
      }).success,
    ).toBe(true);
  });

  it("rejects invalid built-in connections before execution", () => {
    expect(isConnectionAllowed("output-local-path", "operation")).toBe(false);
    expect(
      ConnectionRuleSchema.safeParse({
        sourceType: "output-local-path",
        targetType: "operation",
      }).success,
    ).toBe(false);
  });
});
