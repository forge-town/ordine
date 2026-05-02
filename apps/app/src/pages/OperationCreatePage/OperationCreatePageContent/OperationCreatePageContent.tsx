import { useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { useCreate, useList } from "@refinedev/core";
import { ResourceName } from "@/integrations/refine/dataProvider";
import { PageHeader } from "@/components/PageHeader";
import { type Skill } from "@repo/schemas";
import { PageLoadingState } from "@/components/PageLoadingState";
import { useStore } from "zustand";
import { useOperationCreatePageStore } from "../_store";
import { OperationForm } from "../../OperationEditPage/_shared/OperationForm";
import { operationFormSchema, type OperationFormValues } from "../../OperationEditPage/_shared/operationFormSchema";

const buildConfig = (values: OperationFormValues): string => {
  if (values.executorType === "agent") {
    if (values.agentMode === "skill") {
      return JSON.stringify({
        executor: {
          type: "agent",
          agentMode: "skill",
          skillId: values.skillId,
        },
      });
    }

    return JSON.stringify({
      executor: {
        type: "agent",
        agentMode: "prompt",
        prompt: values.promptText,
      },
    });
  }

  return JSON.stringify({
    executor: {
      type: "script",
      command: values.scriptCommand,
      language: values.scriptLanguage,
    },
  });
};

export const OperationCreatePageContent = () => {
  const { result: skillsResult, query: skillsQuery } = useList<Skill>({
    resource: ResourceName.skills,
  });
  const skills = skillsResult?.data ?? [];
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { mutateAsync: createOpMutate } = useCreate();

  const store = useOperationCreatePageStore();

  const handleCancel = () => {
    void navigate({ to: "/operations" });
  };

  const onSubmit = async (values: OperationFormValues) => {
    const result = await createOpMutate({
      resource: ResourceName.operations,
      values: {
        id: `op-${Date.now()}`,
        name: values.name,
        description: values.description || null,
        config: buildConfig(values),
        acceptedObjectTypes: values.acceptedObjectTypes,
      },
    });
    const created = result.data;
    if (created) {
      void navigate({
        to: "/operations/$operationId",
        params: { operationId: (created as { id: string }).id },
      });
    }
  };

  if (skillsQuery?.isLoading) {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        <PageHeader title={t("operations.createNew")} />
        <PageLoadingState variant="detail" />
      </div>
    );
  }

  return (
    <OperationForm
      initialValues={{
        name: "",
        description: "",
        acceptedObjectTypes: ["file", "folder", "project"],
        executorType: "agent",
        agentMode: "skill",
        skillId: "",
        promptText: "",
        scriptCommand: "",
        scriptLanguage: "bash",
      }}
      onSubmit={onSubmit}
      skills={skills}
      submitLabel={t("common.save")}
      cancelLabel={t("common.cancel")}
      onCancel={handleCancel}
      pageTitle={t("operations.createNew")}
      backTo="/operations"
      store={store}
      isLoading={skillsQuery?.isLoading}
    />
  );
};
