import { createTool } from "@mastra/core/tools";
import { z } from "zod/v4";
import { CheckOutputSchema } from "../../schemas/CheckOutputSchema";
import { FixOutputSchema } from "../../schemas/FixOutputSchema";

/**
 * A captured report holder. The agent calls submitReport as a tool,
 * and the executor reads back the captured value after generate() finishes.
 */
export interface ReportCapture {
  report: string | null;
}

export const createSubmitReportTool = (capture: ReportCapture) =>
  createTool({
    id: "submitReport",
    description:
      "Submit the final JSON report. You MUST call this tool as your LAST action. " +
      "Pass the full JSON report object as the 'report' argument.",
    inputSchema: z.object({
      report: z
        .union([CheckOutputSchema, FixOutputSchema])
        .describe("The full report object matching CheckOutput or FixOutput schema"),
    }),
    execute: async ({ report }) => {
      capture.report = JSON.stringify(report, null, 2);
      return { success: true, message: "Report submitted successfully." };
    },
  });
