import { describe, it, expect } from "vitest";
import { evaluateLoopCondition } from "./pipelineRunnerService";

describe("evaluateLoopCondition", () => {
  const checkOutput = JSON.stringify({
    type: "check",
    summary: "Found 5 errors",
    findings: [],
    stats: {
      totalFiles: 10,
      totalFindings: 5,
      errors: 5,
      warnings: 2,
      infos: 0,
      skipped: 0,
    },
  });

  const cleanOutput = JSON.stringify({
    type: "check",
    summary: "No issues found",
    findings: [],
    stats: {
      totalFiles: 10,
      totalFindings: 0,
      errors: 0,
      warnings: 0,
      infos: 0,
      skipped: 0,
    },
  });

  it("returns true when stats.errors eq 0 on clean output", () => {
    expect(evaluateLoopCondition(cleanOutput, "stats.errors", "eq", 0)).toBe(
      true,
    );
  });

  it("returns false when stats.errors eq 0 on dirty output", () => {
    expect(evaluateLoopCondition(checkOutput, "stats.errors", "eq", 0)).toBe(
      false,
    );
  });

  it("supports lte operator", () => {
    expect(evaluateLoopCondition(checkOutput, "stats.errors", "lte", 5)).toBe(
      true,
    );
    expect(evaluateLoopCondition(checkOutput, "stats.errors", "lte", 4)).toBe(
      false,
    );
  });

  it("supports gte operator", () => {
    expect(evaluateLoopCondition(checkOutput, "stats.errors", "gte", 5)).toBe(
      true,
    );
    expect(evaluateLoopCondition(checkOutput, "stats.errors", "gte", 6)).toBe(
      false,
    );
  });

  it("supports lt operator", () => {
    expect(evaluateLoopCondition(checkOutput, "stats.errors", "lt", 6)).toBe(
      true,
    );
    expect(evaluateLoopCondition(checkOutput, "stats.errors", "lt", 5)).toBe(
      false,
    );
  });

  it("supports gt operator", () => {
    expect(evaluateLoopCondition(checkOutput, "stats.errors", "gt", 4)).toBe(
      true,
    );
    expect(evaluateLoopCondition(checkOutput, "stats.errors", "gt", 5)).toBe(
      false,
    );
  });

  it("traverses nested dot paths", () => {
    const nested = JSON.stringify({ a: { b: { c: 42 } } });
    expect(evaluateLoopCondition(nested, "a.b.c", "eq", 42)).toBe(true);
    expect(evaluateLoopCondition(nested, "a.b.c", "eq", 0)).toBe(false);
  });

  it("returns false for non-JSON content", () => {
    expect(evaluateLoopCondition("not json", "stats.errors", "eq", 0)).toBe(
      false,
    );
  });

  it("returns false for missing field path", () => {
    expect(
      evaluateLoopCondition(checkOutput, "stats.nonExistent", "eq", 0),
    ).toBe(false);
  });

  it("returns false when field value is not a number", () => {
    const stringVal = JSON.stringify({ stats: { type: "check" } });
    expect(evaluateLoopCondition(stringVal, "stats.type", "eq", 0)).toBe(false);
  });
});
