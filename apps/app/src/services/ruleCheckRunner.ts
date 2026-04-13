/**
 * Rule Check Runner
 *
 * Executes each enabled rule's check script against the input path.
 * Each rule has its own script (bash/python/javascript) that runs
 * with INPUT_PATH as context. Exit code 0 = pass, non-zero = fail.
 * Stdout is captured as the rule's output/message.
 */

import { exec } from "node:child_process";
import { promisify } from "node:util";
import { rulesDao, type RuleEntity } from "@/models/daos/rulesDao";
import type { CheckOutput, Finding } from "@/schemas/OperationOutputSchema";

const execAsync = promisify(exec);

const SCRIPT_TIMEOUT_MS = 30_000;

interface RuleCheckResult {
  rule: RuleEntity;
  passed: boolean;
  output: string;
  exitCode: number;
}

function buildCommand(rule: RuleEntity): string {
  const script = rule.checkScript!;
  const lang = rule.scriptLanguage ?? "bash";
  if (lang === "python") return `python3 -c ${JSON.stringify(script)}`;
  if (lang === "javascript") return `node -e ${JSON.stringify(script)}`;
  return script;
}

async function executeRule(rule: RuleEntity, inputPath: string): Promise<RuleCheckResult> {
  const cmd = buildCommand(rule);
  const env = { ...process.env, INPUT_PATH: inputPath };

  try {
    const { stdout } = await execAsync(cmd, { env, timeout: SCRIPT_TIMEOUT_MS });
    return { rule, passed: true, output: stdout.trim(), exitCode: 0 };
  } catch (err: unknown) {
    const execErr = err as { code?: number; stdout?: string; stderr?: string };
    const output = (execErr.stdout ?? execErr.stderr ?? "").trim();
    return {
      rule,
      passed: false,
      output: output || "Rule check failed",
      exitCode: execErr.code ?? 1,
    };
  }
}

function resultToFinding(result: RuleCheckResult): Finding | null {
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
}

export async function runRuleCheck(inputPath: string): Promise<CheckOutput> {
  const rules = await rulesDao.findMany({ enabled: true });
  const activeRules = rules.filter((r) => r.checkScript != null && r.checkScript.trim() !== "");

  const results: RuleCheckResult[] = [];
  for (const rule of activeRules) {
    const result = await executeRule(rule, inputPath);
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
}
