import { useNavigate } from "@tanstack/react-router";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";
import {
  ArrowLeft,
  BookOpen,
  Code2,
  ClipboardCheck,
  Download,
  FileText,
  Info,
  Pencil,
  Tag,
  Terminal,
  Brain,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@repo/ui/button";
import { cn } from "@repo/ui/lib/utils";
import type { BestPractice, ChecklistItem, CodeSnippet } from "@repo/schemas";
import { exportSingleBestPractice } from "@/lib/exportBestPractice";
import { CATEGORIES, CATEGORY_COLORS } from "@/pages/BestPracticesPage/constants";
import { useList } from "@refinedev/core";
import { ResourceName } from "@/integrations/refine/dataProvider";
import { Route } from "@/routes/_layout/best-practices.$bestPracticeId.index";
import { PageLoadingState } from "@/components/PageLoadingState";

interface Props {
  bestPractice: BestPractice;
}

export const BestPracticeDetailPageContent = ({ bestPractice }: Props) => {
  const { bestPracticeId } = Route.useParams();

  const { result: checklistResult, query: checklistQuery } = useList<ChecklistItem>({
    resource: ResourceName.checklistItems,
    filters: [{ field: "bestPracticeId", operator: "eq", value: bestPracticeId }],
  });
  const { result: snippetsResult, query: snippetsQuery } = useList<CodeSnippet>({
    resource: ResourceName.codeSnippets,
    filters: [{ field: "bestPracticeId", operator: "eq", value: bestPracticeId }],
  });

  const checklistItems = checklistResult?.data ?? [];
  const codeSnippets = snippetsResult?.data ?? [];

  const { t } = useTranslation();
  const navigate = useNavigate();

  if (checklistQuery?.isLoading || snippetsQuery?.isLoading) {
    return <PageLoadingState title={bestPractice.title} variant="detail" />;
  }

  const handleNavigateBack = () => void navigate({ to: "/best-practices" });

  const handleNavigateToEdit = () =>
    void navigate({
      to: "/best-practices/$bestPracticeId/edit",
      params: { bestPracticeId: bestPractice.id },
    });

  const handleExport = () => void exportSingleBestPractice(bestPractice.id, bestPractice.title);

  const hasContent = bestPractice.content.trim().length > 0;
  const hasSnippets = codeSnippets.length > 0;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-6">
        <Button
          aria-label={t("bestPractices.backToList")}
          className="h-8 w-8"
          size="icon"
          variant="ghost"
          onClick={handleNavigateBack}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold text-foreground">{bestPractice.title}</h1>
          <p className="font-mono text-[11px] text-muted-foreground">{bestPractice.id}</p>
        </div>
        <Button aria-label={t("common.export")} size="sm" variant="outline" onClick={handleExport}>
          <Download className="h-4 w-4" />
          {t("common.export")}
        </Button>
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
            {t("bestPractices.basicInfo")}
          </div>

          <div className="flex flex-wrap items-center gap-1.5 mb-3">
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
                CATEGORY_COLORS[bestPractice.category] ?? "bg-muted text-muted-foreground"
              )}
            >
              {CATEGORIES.find((c) => c.value === bestPractice.category)?.label ??
                bestPractice.category}
            </span>
            <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground font-mono">
              {bestPractice.language}
            </span>
            {bestPractice.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-0.5 rounded-full bg-muted/50 px-2 py-0.5 text-[11px] text-muted-foreground"
              >
                <Tag className="h-2.5 w-2.5" />
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Condition */}
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-amber-600">
            <BookOpen className="h-4 w-4" />
            {t("bestPractices.conditionSection")}
          </div>
          <p className="text-sm leading-relaxed text-foreground">{bestPractice.condition}</p>
        </div>

        {/* Content */}
        {hasContent && (
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <FileText className="h-4 w-4" />
              {t("bestPractices.contentSection")}
            </div>
            <pre className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {bestPractice.content}
            </pre>
          </div>
        )}

        {/* Code snippets */}
        {hasSnippets && (
          <div className="rounded-xl border border-border bg-card p-4 space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <Code2 className="h-4 w-4" />
              {t("bestPractices.codeSnippetBtn")}
              <span className="ml-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                {codeSnippets.length}
              </span>
            </div>
            {codeSnippets.map((snippet) => (
              <div key={snippet.id}>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-foreground">{snippet.title}</span>
                  <span className="rounded bg-muted px-2 py-0.5 text-[11px] font-mono text-muted-foreground">
                    {snippet.language}
                  </span>
                </div>
                <div className="overflow-hidden rounded-md border border-border text-xs">
                  <CodeMirror
                    readOnly
                    editable={false}
                    extensions={
                      snippet.language === "typescript" ||
                      snippet.language === "tsx" ||
                      snippet.language === "javascript"
                        ? [javascript({ typescript: true, jsx: true })]
                        : []
                    }
                    height="auto"
                    theme={oneDark}
                    value={snippet.code}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Checklist */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <ClipboardCheck className="h-4 w-4" />
            {t("bestPractices.checklist")}
            {checklistItems.length > 0 && (
              <span className="ml-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                {checklistItems.length} {t("bestPractices.checklistItemCount")}
              </span>
            )}
          </div>

          {checklistItems.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t("bestPractices.checklistEmpty")}</p>
          ) : (
            <div className="space-y-2">
              {checklistItems.map((item, idx) => (
                <div
                  key={item.id}
                  className="flex items-start gap-3 rounded-lg border border-border bg-background p-3"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-medium text-muted-foreground">
                    {idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{item.title}</span>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
                          item.checkType === "script"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-purple-100 text-purple-700"
                        )}
                      >
                        {item.checkType === "script" ? (
                          <Terminal className="h-2.5 w-2.5" />
                        ) : (
                          <Brain className="h-2.5 w-2.5" />
                        )}
                        {item.checkType === "script"
                          ? t("bestPractices.checklistItemCheckTypeScript")
                          : t("bestPractices.checklistItemCheckTypeLlm")}
                      </span>
                    </div>
                    {item.description && (
                      <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                        {item.description}
                      </p>
                    )}
                    {item.checkType === "script" && item.script && (
                      <pre className="mt-2 overflow-x-auto rounded bg-muted p-2 font-mono text-[11px] leading-relaxed text-foreground">
                        {item.script}
                      </pre>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Metadata */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <Tag className="h-4 w-4" />
            {t("bestPractices.metadata")}
          </div>
          <div className="space-y-0">
            <div className="flex items-start gap-3 border-b border-border/50 py-2.5">
              <span className="w-20 shrink-0 text-xs text-muted-foreground">
                {t("common.createdAt")}
              </span>
              <span className="text-xs text-foreground">
                {bestPractice.meta?.createdAt?.toLocaleString() ?? "-"}
              </span>
            </div>
            <div className="flex items-start gap-3 py-2.5">
              <span className="w-20 shrink-0 text-xs text-muted-foreground">
                {t("common.updatedAt")}
              </span>
              <span className="text-xs text-foreground">
                {bestPractice.meta?.updatedAt?.toLocaleString() ?? "-"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
