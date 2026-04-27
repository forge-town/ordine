import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Route } from "@/routes/_layout/rules.$ruleId.edit";
import { useOne, useUpdate } from "@refinedev/core";
import { ResourceName } from "@/integrations/refine/dataProvider";
import type { Rule } from "@repo/schemas";
import { RuleForm } from "@/pages/RulesPage/RuleForm";
import { getEditForm, type RuleFormState } from "@/pages/RulesPage/types";
import { PageLoadingState } from "@/components/PageLoadingState";
import { PageHeader } from "@/components/PageHeader";

export const RuleEditPageContent = () => {
  const { ruleId } = Route.useParams();
  const { result: ruleResult, query: ruleQuery } = useOne<Rule>({
    resource: ResourceName.rules,
    id: ruleId,
  });
  const rule = ruleResult ?? null;
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { mutateAsync: updateRuleMutate } = useUpdate();

  if (ruleQuery?.isLoading) {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        <PageHeader title={t("rules.editTitle")} />
        <PageLoadingState variant="detail" />
      </div>
    );
  }

  if (!rule) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
        {t("rules.notFound")}
      </div>
    );
  }

  const handleNavigateBack = () =>
    void navigate({ to: "/rules/$ruleId", params: { ruleId: rule.id } });

  const handleSave = async (form: RuleFormState) => {
    await updateRuleMutate({
      resource: ResourceName.rules,
      id: rule.id,
      values: {
        name: form.name,
        description: form.description || null,
        category: form.category,
        severity: form.severity,
        checkScript: form.checkScript || null,
        scriptLanguage: form.scriptLanguage,
        acceptedObjectTypes: form.acceptedObjectTypes,
        tags: form.tags
          ? form.tags
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean)
          : [],
      },
    });
    void navigate({ to: "/rules/$ruleId", params: { ruleId: rule.id } });
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader backTo={`/rules/${rule.id}`} title={t("rules.editTitle")} />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-2xl">
          <RuleForm initial={getEditForm(rule)} onCancel={handleNavigateBack} onSave={handleSave} />
        </div>
      </div>
    </div>
  );
};
