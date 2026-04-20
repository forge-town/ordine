import { describe, expect, it, vi, beforeEach } from "vitest";
import type { RuleRecord } from "@repo/db-schema";

vi.mock("node:child_process", () => ({
  exec: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  unlink: vi.fn().mockResolvedValue(undefined),
}));

import { exec } from "node:child_process";
import { runRuleCheck } from ".";

type ExecCallback = (err: unknown, result: unknown) => void;
type MockExecImpl = (cmd: string, opts: unknown, cb: ExecCallback) => unknown;
const mockExec = vi.mocked(exec) as unknown as { mockImplementation: (fn: MockExecImpl) => void };

const makeRule = (overrides: Partial<RuleRecord> = {}): RuleRecord => ({
  id: "rule-1",
  name: "no-console",
  description: "No console.log allowed",
  category: "lint",
  severity: "warning",
  checkScript: "export default (t) => true;",
  scriptLanguage: "typescript",
  acceptedObjectTypes: ["project"],
  enabled: true,
  tags: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe("ruleCheckRunner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty findings when no rules are active", async () => {
    const dao = { findMany: vi.fn().mockResolvedValue([]) };
    const result = await runRuleCheck(dao, "/tmp/project");

    expect(result.type).toBe("check");
    expect(result.findings).toHaveLength(0);
    expect(result.stats.totalFindings).toBe(0);
  });

  it("skips rules with empty checkScript", async () => {
    const dao = {
      findMany: vi
        .fn()
        .mockResolvedValue([
          makeRule({ checkScript: null }),
          makeRule({ id: "rule-2", checkScript: "   " }),
        ]),
    };
    const result = await runRuleCheck(dao, "/tmp/project");
    expect(result.findings).toHaveLength(0);
    expect(vi.mocked(exec)).not.toHaveBeenCalled();
  });

  it("reports passing rule as no findings", async () => {
    mockExec.mockImplementation((_cmd: string, _opts: unknown, cb: ExecCallback) => {
      cb(null, { stdout: "ok\n", stderr: "" });
    });
    const dao = { findMany: vi.fn().mockResolvedValue([makeRule()]) };
    const result = await runRuleCheck(dao, "/tmp/project");

    expect(result.findings).toHaveLength(0);
    expect(result.summary).toContain("1 passed");
  });

  it("reports failing rule as finding with correct severity", async () => {
    mockExec.mockImplementation((_cmd: string, _opts: unknown, cb: ExecCallback) => {
      cb({ code: 1, stdout: "Found console.log at line 5", stderr: "" }, null);
    });
    const dao = {
      findMany: vi.fn().mockResolvedValue([makeRule({ severity: "error" })]),
    };
    const result = await runRuleCheck(dao, "/tmp/project");

    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]!.severity).toBe("error");
    expect(result.findings[0]!.message).toContain("no-console");
    expect(result.stats.errors).toBe(1);
  });

  it("handles multiple rules with mixed results", async () => {
    let callCount = 0;
    mockExec.mockImplementation((_cmd: string, _opts: unknown, cb: ExecCallback) => {
      callCount++;
      if (callCount === 1) {
        cb(null, { stdout: "ok", stderr: "" });
      } else {
        cb({ code: 1, stdout: "violation", stderr: "" }, null);
      }
    });
    const dao = {
      findMany: vi
        .fn()
        .mockResolvedValue([
          makeRule({ id: "r1", name: "passes" }),
          makeRule({ id: "r2", name: "fails" }),
        ]),
    };
    const result = await runRuleCheck(dao, "/tmp/project");

    expect(result.findings).toHaveLength(1);
    expect(result.summary).toContain("1 passed");
    expect(result.summary).toContain("1 failed");
  });
});
