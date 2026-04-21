import { z } from "zod/v4";
import { SeveritySchema } from "./SeveritySchema";

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
