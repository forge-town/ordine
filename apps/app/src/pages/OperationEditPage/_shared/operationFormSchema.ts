import { z } from "zod/v4";
import {
  ObjectTypeSchema,
  ExecutorTypeSchema,
  AgentModeSchema,
  ScriptLanguageSchema,
} from "@repo/schemas";

export const operationFormSchema = z.object({
  name: z.string().min(1, "名称不能为空"),
  description: z.string(),
  acceptedObjectTypes: z.array(ObjectTypeSchema).min(1),
  executorType: ExecutorTypeSchema,
  agentMode: AgentModeSchema,
  skillId: z.string(),
  promptText: z.string(),
  scriptCommand: z.string(),
  scriptLanguage: ScriptLanguageSchema,
});

export type OperationFormValues = z.infer<typeof operationFormSchema>;
