import { z } from "zod/v4";
import { FindingSchema } from "./FindingSchema";
import { ChangeSchema } from "./ChangeSchema";

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
