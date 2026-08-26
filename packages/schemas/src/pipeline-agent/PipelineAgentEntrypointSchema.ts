import { z } from "zod/v4";

export const PipelineAgentEntrypointSchema = z.enum([
  "new-pipeline-dialog",
  "canvas-agent-panel",
  "global-agent-bar",
  "agent-control-external",
]);
export type PipelineAgentEntrypoint = z.infer<typeof PipelineAgentEntrypointSchema>;
