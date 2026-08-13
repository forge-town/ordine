import { describe, expect, it } from "vitest";
import { inferCapabilityRiskTier, tokenizeCapabilityName } from "./inferCapabilityRiskTier";

describe("inferCapabilityRiskTier", () => {
  it.each([
    ["getIssue", "readonly"],
    ["list_issues", "readonly"],
    ["search-issues", "readonly"],
    ["createIssue", "write"],
    ["update_issue", "write"],
    ["upload-file", "write"],
    ["deleteIssue", "irreversible"],
    ["send_message", "irreversible"],
    ["deploy-release", "irreversible"],
  ] as const)("infers %s as %s", (name, expected) => {
    expect(inferCapabilityRiskTier(name)).toBe(expected);
  });

  it("uses the highest matched risk", () => {
    expect(inferCapabilityRiskTier("getAndDeleteIssue")).toBe("irreversible");
    expect(inferCapabilityRiskTier("read_then_update_record")).toBe("write");
  });

  it("defaults unknown names to write", () => {
    expect(inferCapabilityRiskTier("summarize_content")).toBe("write");
  });

  it("splits camelCase, acronyms, snake_case, and kebab-case", () => {
    expect(tokenizeCapabilityName("HTTPFetch_create-item")).toEqual([
      "http",
      "fetch",
      "create",
      "item",
    ]);
  });
});
