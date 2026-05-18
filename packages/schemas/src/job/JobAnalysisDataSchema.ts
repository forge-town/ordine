import { z } from "zod/v4";
import { AgentRawExportSchema } from "../agent-trace/AgentRawExportSchema";
import { AgentSpanSchema } from "../agent-trace/AgentSpanSchema";
import { JobTraceSchema } from "./JobTraceSchema";

export const JobAnalysisDataSchema = z.object({
  traces: z.array(JobTraceSchema),
  agentRuns: z.array(AgentRawExportSchema),
  spansByRun: z.record(z.coerce.number(), z.array(AgentSpanSchema)),
});
export type JobAnalysisData = z.infer<typeof JobAnalysisDataSchema>;
