/**
 * Structured output schemas for agent operations.
 *
 * Defines the JSON format that check/fix operations must produce,
 * along with example instances used in prompt instructions.
 */

import { z } from "zod/v4";

// ─── Severity levels ─────────────────────────────────────────────────────────

export const SeveritySchema = z.enum(["error", "warning", "info"]);
export type Severity = z.infer<typeof SeveritySchema>;

// ─── A single finding from a check operation ─────────────────────────────────

export const FindingSchema = z.object({
  id: z.string().describe("Unique identifier for this finding, e.g. 'ERR_001'"),
  severity: SeveritySchema,
  message: z.string().describe("One-line summary of the issue"),
  file: z.string().describe("Relative file path from project root"),
  line: z.number().optional().describe("Line number (1-based) if applicable"),
  rule: z.string().optional().describe("Rule or standard violated, e.g. 'no-try-catch'"),
  snippet: z.string().optional().describe("Short code snippet showing the violation"),
  suggestion: z.string().optional().describe("Suggested fix or recommendation"),
  skipped: z
    .boolean()
    .optional()
    .describe("True if this finding is an allowed exception and should not be fixed"),
  skipReason: z
    .string()
    .optional()
    .describe("Why this finding was skipped (e.g. 'framework boundary')"),
});
export type Finding = z.infer<typeof FindingSchema>;

// ─── A single change made by an autofix operation ────────────────────────────

export const ChangeSchema = z.object({
  file: z.string().describe("Relative file path that was modified"),
  action: z.enum(["replace", "create", "delete"]),
  description: z.string().describe("What was changed"),
  findingId: z.string().optional().describe("The finding ID this change addresses"),
});
export type Change = z.infer<typeof ChangeSchema>;

// ─── Check operation output ──────────────────────────────────────────────────

export const CheckOutputSchema = z.object({
  type: z.literal("check"),
  summary: z.string().describe("Executive summary of the check results"),
  findings: z.array(FindingSchema),
  stats: z.object({
    totalFiles: z.number().describe("Number of files scanned"),
    totalFindings: z.number().describe("Total findings count"),
    errors: z.number(),
    warnings: z.number(),
    infos: z.number(),
    skipped: z.number().describe("Findings marked as allowed exceptions"),
  }),
});
export type CheckOutput = z.infer<typeof CheckOutputSchema>;

// ─── Fix operation output ────────────────────────────────────────────────────

export const FixOutputSchema = z.object({
  type: z.literal("fix"),
  summary: z.string().describe("Summary of all changes made"),
  changes: z.array(ChangeSchema),
  remainingFindings: z.array(FindingSchema).describe("Findings that could not be auto-fixed"),
  stats: z.object({
    totalChanges: z.number(),
    filesModified: z.number(),
    findingsFixed: z.number(),
    findingsSkipped: z.number(),
  }),
});
export type FixOutput = z.infer<typeof FixOutputSchema>;

// ─── Union of all operation outputs ──────────────────────────────────────────

export const OperationOutputSchema = z.discriminatedUnion("type", [
  CheckOutputSchema,
  FixOutputSchema,
]);
export type OperationOutput = z.infer<typeof OperationOutputSchema>;

// ─── Example instances (validated at import time) ────────────────────────────

export const CHECK_OUTPUT_EXAMPLE: CheckOutput = {
  type: "check" as const,
  summary: "Executive summary of the check results",
  findings: [
    {
      id: "FINDING_001",
      severity: "error" as const,
      message: "One-line description of the issue",
      file: "relative/path/to/file.ts",
      line: 42,
      rule: "rule-name",
      snippet: "short code snippet showing the violation",
      suggestion: "how to fix the issue",
      skipped: false,
      skipReason: "reason if skipped (only when skipped=true)",
    },
  ],
  stats: {
    totalFiles: 10,
    totalFindings: 5,
    errors: 2,
    warnings: 2,
    infos: 1,
    skipped: 1,
  },
};
CheckOutputSchema.parse(CHECK_OUTPUT_EXAMPLE);

export const FIX_OUTPUT_EXAMPLE: FixOutput = {
  type: "fix" as const,
  summary: "Summary of all changes made",
  changes: [
    {
      file: "relative/path/to/file.ts",
      action: "replace" as const,
      description: "What was changed",
      findingId: "FINDING_001",
    },
  ],
  remainingFindings: [
    {
      id: "FINDING_002",
      severity: "warning" as const,
      message: "Issue that could not be auto-fixed",
      file: "relative/path/to/other.ts",
    },
  ],
  stats: {
    totalChanges: 3,
    filesModified: 2,
    findingsFixed: 3,
    findingsSkipped: 1,
  },
};
FixOutputSchema.parse(FIX_OUTPUT_EXAMPLE);
