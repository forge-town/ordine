import { z } from "zod/v4";
import { FindingSchema } from "./FindingSchema";

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
