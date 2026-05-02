import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useUpdate } from "@refinedev/core";
import { ResourceName } from "@/integrations/refine/dataProvider";
import {
  type Operation,
  type Skill,
  type ExecutorType,
  type AgentMode,
  type OperationConfigInput,
} from "@repo/schemas";
import { useOperationEditPageStore } from "../_store";
import { OperationForm } from "../../OperationEditPage/_shared/OperationForm";
import { type OperationFormValues } from "../../OperationEditPage/_shared/operationFormSchema";

const buildConfig = (values: OperationFormValues): OperationConfigInput => {
  if (values.executorType === "agent") {
    if (values.agentMode === "skill") {
      return {
        executor: {
          type: "agent",
          agentMode: "skill",
          skillId: values.skillId,
        },
      };
    }

    return {
      executor: {
        type: "agent",
        agentMode: "prompt",
        prompt: values.promptText,
      },
    };
  }

  return {
    executor: {
      type: "script",
      command: values.scriptCommand,
      language: values.scriptLanguage,
    },
  };
};

const parseExecutorDefaults = (
  config: OperationConfigInput
): {
  executorType: ExecutorType;
  agentMode: AgentMode;
  skillId: string;
  promptText: string;
  scriptCommand: string;
  scriptLanguage: "bash" | "python" | "javascript";
} => {
  const defaults = {
    executorType: "script" as ExecutorType,
    agentMode: "skill" as AgentMode,
    skillId: "",
    promptText: "",
    scriptCommand: "",
    scriptLanguage: "bash" as "bash" | "python" | "javascript",
  };

  const ex = config.executor;
  if (!ex) return defaults;

  const { executorType, agentMode } = (() => {
    if (ex.type === "agent") {
      return {
        executorType: "agent" as ExecutorType,
        agentMode: (["skill", "prompt"].includes(ex.agentMode ?? "")
          ? ex.agentMode
          : "skill") as AgentMode,
      };
    }

    return { executorType: "script" as ExecutorType, agentMode: "skill" as AgentMode };
  })();

  return {
    executorType,
    agentMode,
    skillId: ex.skillId ?? "",
    promptText: ex.prompt ?? "",
    scriptCommand: ex.command ?? "",
    scriptLanguage: (["bash", "python", "javascript"].includes(ex.language ?? "")
      ? ex.language
      : "bash") as "bash" | "python" | "javascript",
  };
};

interface Props {
  operation: Operation;
  skills: Skill[];
}

export const OperationEditPageContent = ({ operation, skills }: Props) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { mutateAsync: updateOpMutate } = useUpdate();

  const store = useOperationEditPageStore();

  const handleCancel = () => {
    void navigate({
      to: "/operations/$operationId",
      params: { operationId: operation.id },
    });
  };

  const handleSubmit = async (values: OperationFormValues) => {
    await updateOpMutate({
      resource: ResourceName.operations,
      id: operation.id,
      values: {
        name: values.name,
        description: values.description || null,
        config: buildConfig(values),
        acceptedObjectTypes: values.acceptedObjectTypes,
      },
    });
    void navigate({
      to: "/operations/$operationId",
      params: { operationId: operation.id },
    });
  };

  return (
    <OperationForm
      backTo={`/operations/${operation.id}`}
      cancelLabel={t("common.cancel")}
      initialValues={{
        name: operation.name,
        description: operation.description ?? "",
        acceptedObjectTypes: Array.isArray(operation.acceptedObjectTypes)
          ? [...operation.acceptedObjectTypes]
          : ["file", "folder", "project"],
        ...parseExecutorDefaults(operation.config),
      }}
      pageTitle={t("operations.editOperation")}
      skills={skills}
      store={store}
      submitLabel={t("common.save")}
      onCancel={handleCancel}
      onSubmit={handleSubmit}
    />
  );
};
