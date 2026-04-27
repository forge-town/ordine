import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useCreate } from "@refinedev/core";
import { ResourceName } from "@/integrations/refine/dataProvider";
import { RuleForm } from "@/pages/RulesPage/RuleForm";
import type { RuleFormState } from "@/pages/RulesPage/types";
import { PageHeader } from "@/components/PageHeader";

export const RuleCreatePageContent = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { mutateAsync: createRuleMutate } = useCreate();

  const handleNavigateBack = () => void navigate({ to: "/rules" });

  const handleSave = async (form: RuleFormState) => {
    const result = await createRuleMutate({
      resource: ResourceName.rules,
      values: {
        id: crypto.randomUUID(),
        name: form.name,
        description: form.description || null,
        category: form.category,
        severity: form.severity,
        checkScript: form.checkScript || null,
        scriptLanguage: form.scriptLanguage,
        acceptedObjectTypes: form.acceptedObjectTypes,
        enabled: true,
        tags: form.tags
          ? form.tags
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean)
          : [],
      },
    });
    const rule = result.data;
    void navigate({ to: "/rules/$ruleId", params: { ruleId: (rule as { id: string }).id } });
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader backTo="/rules" title={t("rules.createTitle")} />

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-2xl">
          <RuleForm onCancel={handleNavigateBack} onSave={handleSave} />
        </div>
      </div>
    </div>
  );
};
