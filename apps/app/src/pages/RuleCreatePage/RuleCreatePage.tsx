import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@repo/ui/button";
import { createRule } from "@/services/rulesService";
import { RuleForm } from "@/pages/RulesPage/RuleForm";
import type { RuleFormState } from "@/pages/RulesPage/types";

export const RuleCreatePage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleNavigateBack = () => void navigate({ to: "/rules" });

  const handleSave = async (form: RuleFormState) => {
    const rule = await createRule({
      data: {
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
    void navigate({ to: "/rules/$ruleId", params: { ruleId: rule.id } });
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-6">
        <Button
          aria-label={t("rules.backToList")}
          className="h-8 w-8"
          size="icon"
          variant="ghost"
          onClick={handleNavigateBack}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-sm font-semibold text-foreground">{t("rules.createTitle")}</h1>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-2xl">
          <RuleForm onCancel={handleNavigateBack} onSave={handleSave} />
        </div>
      </div>
    </div>
  );
};
