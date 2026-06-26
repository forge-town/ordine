import { z } from "zod/v4";

export const PipelineAgentModeSchema = z.enum(["generate", "edit"]);
export type PipelineAgentMode = z.infer<typeof PipelineAgentModeSchema>;
