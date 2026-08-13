import { z } from "zod/v4";
import { OperationExecutorTypeSchema } from "./OperationExecutorTypeSchema";
import { AgentModeSchema } from "../agent/AgentModeSchema";
import { AgentRuntimeSchema } from "../agent-runtime/AgentRuntimeSchema";
import { ScriptLanguageSchema } from "../common/ScriptLanguageSchema";

export const OperationAssignmentReasonSchema = z
  .string()
  .trim()
  .min(1)
  .max(240)
  .refine((reason) => !/[\r\n]/u.test(reason), "assignmentReason must be one line");

export const OperationExecutorConfigSchema = z.object({
  type: OperationExecutorTypeSchema,
  agentMode: AgentModeSchema.optional(),
  agent: AgentRuntimeSchema.optional(),
  model: z.string().trim().min(1).optional(),
  skillId: z.string().optional(),
  systemPrompt: z.string().optional(),
  prompt: z.string().optional(),
  command: z.string().optional(),
  language: ScriptLanguageSchema.optional(),
  allowedTools: z.array(z.string()).optional(),
  assignmentReason: OperationAssignmentReasonSchema.optional(),
});
export type OperationExecutorConfig = z.infer<typeof OperationExecutorConfigSchema>;

const AssignedAgentExecutorFields = {
  type: z.literal("agent"),
  agent: AgentRuntimeSchema,
  model: z.string().trim().min(1),
  allowedTools: z.array(z.string().trim().min(1)).max(8),
  assignmentReason: OperationAssignmentReasonSchema,
};

/** Strict replacement shape emitted by per-step assignment and updateOperation. */
export const AssignedOperationExecutorConfigSchema = z.union([
  z
    .object({
      type: z.literal("script"),
      language: ScriptLanguageSchema,
      command: z.string().trim().min(1).max(8000),
      assignmentReason: OperationAssignmentReasonSchema,
    })
    .strict(),
  z
    .object({
      ...AssignedAgentExecutorFields,
      agentMode: z.literal("prompt"),
      prompt: z.string().trim().min(1).max(8000),
    })
    .strict(),
  z
    .object({
      ...AssignedAgentExecutorFields,
      agentMode: z.literal("skill"),
      skillId: z.string().trim().min(1),
    })
    .strict(),
]);
export type AssignedOperationExecutorConfig = z.infer<typeof AssignedOperationExecutorConfigSchema>;
