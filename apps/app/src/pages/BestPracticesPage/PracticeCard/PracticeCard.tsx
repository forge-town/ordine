import { useState } from "react";
import {
  BookOpen,
  Code2,
  ChevronDown,
  ChevronUp,
  Download,
  FileText,
  Pencil,
  Trash2,
  Tag,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { cn } from "@repo/ui/lib/utils";
import type { BestPracticeEntity } from "@/models/daos/bestPracticesDao";
import { exportSingleBestPractice } from "@/lib/exportBestPractice";
import { CATEGORIES, CATEGORY_COLORS } from "../constants";

export type PracticeCardProps = {
  practice: BestPracticeEntity;
  onDelete: () => void;
};

export const PracticeCard = ({ practice, onDelete }: PracticeCardProps) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [contentExpanded, setContentExpanded] = useState(false);
  const hasCode = practice.codeSnippet.trim().length > 0;
  const hasContent = practice.content.trim().length > 0;
  const handleToggleExpanded = () => setExpanded((v) => !v);
  const handleToggleContent = () => setContentExpanded((v) => !v);
  const handleDelete = onDelete;
  const handleExport = () => void exportSingleBestPractice(practice.id, practice.title);

  return (
    <div className="group rounded-xl border border-border bg-card overflow-hidden hover:border-primary/50 hover:shadow-sm transition-all">
      {/* Header */}
      <div className="flex items-start gap-3 p-4">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <BookOpen className="h-4 w-4 text-primary" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground leading-snug">
              <Link
                className="hover:text-primary hover:underline transition-colors"
                params={{ bestPracticeId: practice.id }}
                to="/best-practices/$bestPracticeId"
              >
                {practice.title}
              </Link>
            </h3>
            <div className="flex shrink-0 items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Link
                className="flex h-6 w-6 items-center justify-center rounded hover:bg-accent"
                params={{ bestPracticeId: practice.id }}
                to="/best-practices/$bestPracticeId/edit"
              >
                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
              </Link>
              <button
                className="flex h-6 w-6 items-center justify-center rounded hover:bg-accent"
                onClick={handleExport}
              >
                <Download className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
              <button
                className="flex h-6 w-6 items-center justify-center rounded hover:bg-destructive/10"
                onClick={handleDelete}
              >
                <Trash2 className="h-3.5 w-3.5 text-red-400" />
              </button>
            </div>
          </div>

          {/* Category badge */}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
                CATEGORY_COLORS[practice.category] ?? "bg-muted text-muted-foreground"
              )}
            >
              {CATEGORIES.find((c) => c.value === practice.category)?.label ?? practice.category}
            </span>
            <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground font-mono">
              {practice.language}
            </span>
            {practice.tags.map((tag) => (
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
      </div>

      {/* Condition */}
      <div className="border-t border-border bg-amber-50/60 px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-600 mb-1">
          {t("bestPractices.conditionSection")}
        </p>
        <p className="text-xs text-foreground leading-relaxed">{practice.condition}</p>
      </div>

      {/* Content toggle */}
      {hasContent && (
        <div className="border-t border-border">
          <button
            className="flex w-full items-center gap-2 px-4 py-2 text-xs text-muted-foreground hover:bg-accent transition-colors"
            onClick={handleToggleContent}
          >
            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="flex-1 text-left font-medium">
              {t("bestPractices.contentSection")}
            </span>
            {contentExpanded ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
          {contentExpanded && (
            <div className="border-t border-border bg-muted/30 px-4 py-3 overflow-x-auto">
              <pre className="text-xs leading-relaxed text-foreground whitespace-pre-wrap">
                {practice.content}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Code snippet toggle */}
      {hasCode && (
        <div className="border-t border-border">
          <button
            className="flex w-full items-center gap-2 px-4 py-2 text-xs text-muted-foreground hover:bg-accent transition-colors"
            onClick={handleToggleExpanded}
          >
            <Code2 className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="flex-1 text-left font-medium">
              {t("bestPractices.codeSnippetBtn")}
            </span>
            {expanded ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
          {expanded && (
            <div className="border-t border-border bg-gray-950 px-4 py-3 overflow-x-auto">
              <pre className="text-xs leading-relaxed text-gray-100 font-mono whitespace-pre">
                {practice.codeSnippet}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
