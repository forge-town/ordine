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
