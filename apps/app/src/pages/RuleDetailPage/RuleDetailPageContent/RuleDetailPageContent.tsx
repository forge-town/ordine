import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Info, Pencil, Tag, ToggleLeft, ToggleRight, Code2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";
import { Button } from "@repo/ui/button";
import { cn } from "@repo/ui/lib/utils";
import type { RuleRecord } from "@repo/db-schema";
import { SEVERITY_CONFIG, CATEGORY_CONFIG } from "@/pages/RulesPage/types";

interface Props {
  rule: RuleRecord;
}

export const RuleDetailPageContent = ({ rule }: Props) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleNavigateBack = () => void navigate({ to: "/rules" });
  const handleNavigateToEdit = () =>
    void navigate({ to: "/rules/$ruleId/edit", params: { ruleId: rule.id } });

  const s = SEVERITY_CONFIG[rule.severity];
  const c = CATEGORY_CONFIG[rule.category];
  const SeverityIcon = s.icon;

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
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <SeverityIcon className={cn("h-4 w-4 shrink-0", s.cls)} />
            <h1 className="truncate text-sm font-semibold text-foreground">{rule.name}</h1>
            {!rule.enabled && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                {t("rules.disabled")}
              </span>
            )}
          </div>
          <p className="font-mono text-[11px] text-muted-foreground">{rule.id}</p>
        </div>
        <Button
          aria-label={t("common.edit")}
          size="sm"
          variant="outline"
          onClick={handleNavigateToEdit}
        >
          <Pencil className="h-4 w-4" />
          {t("common.edit")}
        </Button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* Basic Info */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <Info className="h-4 w-4" />
            {t("rules.basicInfo")}
          </div>

          <div className="flex flex-wrap items-center gap-1.5 mb-3">
            <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", c.cls)}>
              {c.label}
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                s.cls
              )}
            >
              <SeverityIcon className="h-3 w-3" />
              {s.label}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
              {rule.enabled ? (
                <ToggleRight className="h-3 w-3" />
              ) : (
                <ToggleLeft className="h-3 w-3" />
              )}
              {rule.enabled ? t("rules.enabled") : t("rules.disabled")}
            </span>
            {rule.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-0.5 rounded-full bg-muted/50 px-2 py-0.5 text-[11px] text-muted-foreground"
              >
                <Tag className="h-2.5 w-2.5" />
                {tag}
              </span>
            ))}
          </div>

          {rule.description && (
            <p className="text-sm leading-relaxed text-foreground">{rule.description}</p>
          )}
        </div>

        {/* Object Types */}
        {rule.acceptedObjectTypes.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <Code2 className="h-4 w-4" />
              {t("rules.objectTypes")}
            </div>
            <div className="flex gap-2">
              {rule.acceptedObjectTypes.map((type) => (
                <span
                  key={type}
                  className="rounded-md border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
                >
                  {type}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Check Script */}
        {rule.checkScript && (
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                <Code2 className="h-4 w-4" />
                {t("rules.checkScript")}
              </div>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-mono text-muted-foreground">
                {rule.scriptLanguage ?? "typescript"}
              </span>
            </div>
            <div className="overflow-hidden rounded-lg border border-border">
              <CodeMirror
                editable={false}
                extensions={[javascript({ typescript: true, jsx: true })]}
                theme={oneDark}
                value={rule.checkScript}
              />
            </div>
          </div>
        )}

        {/* Metadata */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <Tag className="h-4 w-4" />
            {t("rules.metadata")}
          </div>
          <div className="space-y-0">
            <div className="flex items-start gap-3 border-b border-border/50 py-2.5">
              <span className="w-20 shrink-0 text-xs text-muted-foreground">
                {t("common.createdAt")}
              </span>
              <span className="text-xs text-foreground">
                {new Date(rule.createdAt).toLocaleString()}
              </span>
            </div>
            <div className="flex items-start gap-3 py-2.5">
              <span className="w-20 shrink-0 text-xs text-muted-foreground">
                {t("common.updatedAt")}
              </span>
              <span className="text-xs text-foreground">
                {new Date(rule.updatedAt).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
