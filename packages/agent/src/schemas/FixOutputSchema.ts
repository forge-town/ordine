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
