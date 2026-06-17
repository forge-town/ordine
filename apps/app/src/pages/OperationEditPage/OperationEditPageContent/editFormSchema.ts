import { z } from "zod/v4";
import {
  AgentModeSchema,
  ObjectNodeTypeSchema,
  OperationExecutorTypeSchema,
  OutputItemSchema,
  PublishTargetSchema,
  ScriptLanguageSchema,
  type AgentMode,
  type OperationConfigInput,
  type OperationExecutorType,
  type PublishTarget,
} from "@repo/schemas";

const editableOutputItemSchema = OutputItemSchema.extend({
  templateIds: z.array(z.string()),
});

export const editFormSchema = z.object({
  name: z.string().min(1, "名称不能为空"),
  description: z.string(),
  acceptedObjectTypes: z.array(ObjectNodeTypeSchema).min(1),
  executorType: OperationExecutorTypeSchema,
  agentMode: AgentModeSchema,
  skillId: z.string(),
  promptText: z.string(),
  scriptCommand: z.string(),
  scriptLanguage: ScriptLanguageSchema,
  publishTarget: PublishTargetSchema,
  repo: z.string(),
  branch: z.string(),
  subPath: z.string(),
  commitMessage: z.string(),
  openPr: z.boolean(),
  outputs: z.array(editableOutputItemSchema),
});

export type EditFormValues = z.infer<typeof editFormSchema>;

type ScriptLanguage = "bash" | "python" | "javascript";

export const buildConfig = (values: EditFormValues): OperationConfigInput => {
  if (values.executorType === "agent") {
    return values.agentMode === "skill"
      ? { executor: { type: "agent", agentMode: "skill", skillId: values.skillId } }
      : { executor: { type: "agent", agentMode: "prompt", prompt: values.promptText } };
  }

  if (values.executorType === "publish") {
    return {
      executor: {
        type: "publish",
        publishTarget: values.publishTarget,
        repo: values.repo,
        branch: values.branch || undefined,
        subPath: values.subPath || undefined,
        commitMessage: values.commitMessage || undefined,
        openPr: values.openPr,
      },
    };
  }

  return {
    executor: { type: "script", command: values.scriptCommand, language: values.scriptLanguage },
  };
};

export type ExecutorDefaults = {
  executorType: OperationExecutorType;
  agentMode: AgentMode;
  skillId: string;
  promptText: string;
  scriptCommand: string;
  scriptLanguage: ScriptLanguage;
  publishTarget: PublishTarget;
  repo: string;
  branch: string;
  subPath: string;
  commitMessage: string;
  openPr: boolean;
};

export const parseExecutorDefaults = (config: OperationConfigInput): ExecutorDefaults => {
  const ex = config.executor;
  const executorType: OperationExecutorType =
    ex?.type === "agent" ? "agent" : ex?.type === "publish" ? "publish" : "script";

  return {
    executorType,
    agentMode: (["skill", "prompt"].includes(ex?.agentMode ?? "")
      ? ex?.agentMode
      : "skill") as AgentMode,
    skillId: ex?.skillId ?? "",
    promptText: ex?.prompt ?? "",
    scriptCommand: ex?.command ?? "",
    scriptLanguage: (["bash", "python", "javascript"].includes(ex?.language ?? "")
      ? ex?.language
      : "bash") as ScriptLanguage,
    publishTarget: ex?.publishTarget ?? "git",
    repo: ex?.repo ?? "",
    branch: ex?.branch ?? "",
    subPath: ex?.subPath ?? "",
    commitMessage: ex?.commitMessage ?? "",
    openPr: ex?.openPr ?? true,
  };
};
