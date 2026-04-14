/**
 * Rule Check Runner
 *
 * Executes each enabled rule's check script against the target object.
 *
 * Each rule's `checkScript` must be a TypeScript module that exports a default function:
 *   export default function check(target: RuleTarget): boolean | Promise<boolean>
 *
 * Return true = pass, false = fail.
 *
 * The runner writes the script to a temp file, then uses `bun -e` to dynamically
 * import and invoke the default export with the RuleTarget object.
 */

import { exec } from "node:child_process";
import { writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { ResultAsync } from "neverthrow";
import { rulesDao, type RuleEntity } from "@/models/daos/rulesDao";
import type { CheckOutput, Finding } from "@/schemas/OperationOutputSchema";
import type { RuleTarget } from "@/schemas/RuleSchema";

const execAsync = promisify(exec);

const SCRIPT_TIMEOUT_MS = 30_000;

interface RuleCheckResult {
  rule: RuleEntity;
  passed: boolean;
  output: string;
  exitCode: number;
}

const executeRule = async (rule: RuleEntity, target: RuleTarget): Promise<RuleCheckResult> => {
  const tmpFile = join(tmpdir(), `rule_${rule.id}_${Date.now()}.ts`);
  await writeFile(tmpFile, rule.checkScript!);

  const wrapper = `
const { default: check } = await import(${JSON.stringify(tmpFile)});
const result = await check(${JSON.stringify(target)});
process.exit(result ? 0 : 1);
`;

  const execResult = await ResultAsync.fromPromise(
    execAsync(`bun -e ${JSON.stringify(wrapper)}`, {
      timeout: SCRIPT_TIMEOUT_MS,
    }),
    (error) => error
  );

  const cleanupResult = await ResultAsync.fromPromise(unlink(tmpFile), (error) => error);
  if (cleanupResult.isErr()) {
    console.warn("Failed to clean up temp file:", cleanupResult.error);
  }

  return execResult.match(
    ({ stdout }) => ({
      rule,
      passed: true,
      output: stdout.trim(),
      exitCode: 0,
    }),
    (error) => {
      const execErr = error as { code?: number; stdout?: string; stderr?: string };
      const output = (execErr.stdout ?? execErr.stderr ?? "").trim();
      return {
        rule,
        passed: false,
        output: output || "Rule check failed",
        exitCode: execErr.code ?? 1,
      };
    }
  );
};

const resultToFinding = (result: RuleCheckResult): Finding | null => {
  if (result.passed) return null;

  return {
    id: result.rule.id,
    severity: result.rule.severity,
    message: `[${result.rule.name}] ${result.output.split("\n")[0] ?? "Failed"}`,
    file: ".",
    rule: result.rule.id,
    snippet: result.output.slice(0, 500),
    suggestion: result.rule.description ?? undefined,
  };
};

export const runRuleCheck = async (inputPath: string): Promise<CheckOutput> => {
  const target: RuleTarget = { path: inputPath, type: "project" };
  const rules = await rulesDao.findMany({ enabled: true });
  const activeRules = rules.filter((r) => r.checkScript != null && r.checkScript.trim() !== "");

  const results: RuleCheckResult[] = [];
  for (const rule of activeRules) {
    const result = await executeRule(rule, target);
    results.push(result);
  }

  const findings: Finding[] = results.map(resultToFinding).filter((f): f is Finding => f != null);

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const errors = findings.filter((f) => f.severity === "error").length;
  const warnings = findings.filter((f) => f.severity === "warning").length;
  const infos = findings.filter((f) => f.severity === "info").length;

  return {
    type: "check",
    summary: `Checked ${activeRules.length} rules: ${passed} passed, ${failed} failed (${errors} errors, ${warnings} warnings, ${infos} info).`,
    findings,
    stats: {
      totalFiles: activeRules.length,
      totalFindings: findings.length,
      errors,
      warnings,
      infos,
      skipped: 0,
    },
  };
};
