import { z } from "zod/v4";
import type { AgentInfo } from "./AgentInfoSchema";
import { NodeContextSchema } from "./NodeContextSchema";
import { OperationInfoSchema } from "./OperationInfoSchema";
import { PipelineGlobalContextSchema } from "./PipelineGlobalContextSchema";
import type { SkillInfo } from "./SkillInfoSchema";

export const OperationNodeContextSchema = NodeContextSchema.extend({
  operations: z.map(z.string(), OperationInfoSchema),
  lookupAgent: z.custom<(id: string) => Promise<AgentInfo | null>>(),
  lookupSkill: z.custom<(id: string) => Promise<SkillInfo | null>>(),
  pipelineContext: PipelineGlobalContextSchema.optional(),
  githubToken: z.string().optional(),
  outputDir: z.string().optional(),
});
export type OperationNodeContext = z.infer<typeof OperationNodeContextSchema>;
