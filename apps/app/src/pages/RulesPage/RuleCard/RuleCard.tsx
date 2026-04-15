import { Pencil, Trash2, Tag, ToggleLeft, ToggleRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@repo/ui/lib/utils";
import type { RuleRow } from "@repo/models";
import { SEVERITY_CONFIG, CATEGORY_CONFIG } from "../types";

export type RuleCardProps = {
  rule: RuleRow;
  onDelete: (id: string) => void;
  onToggle: (id: string, enabled: boolean) => void;
  onNavigateToDetail: (id: string) => void;
  onNavigateToEdit: (id: string) => void;
};

export const RuleCard = ({
  rule,
  onDelete,
  onToggle,
  onNavigateToDetail,
  onNavigateToEdit,
}: RuleCardProps) => {
  const { t } = useTranslation();
  const handleToggle = () => onToggle(rule.id, !rule.enabled);
  const handleEdit = () => onNavigateToEdit(rule.id);
  const handleDelete = () => onDelete(rule.id);
  const handleClickName = () => onNavigateToDetail(rule.id);
  const s = SEVERITY_CONFIG[rule.severity];
  const c = CATEGORY_CONFIG[rule.category];
  const SeverityIcon = s.icon;

  return (
    <div
      className={cn(
        "group rounded-xl border border-border bg-card p-4 transition-all",
        !rule.enabled && "opacity-50"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <SeverityIcon className={cn("mt-0.5 h-4 w-4 shrink-0", s.cls)} />
          <div className="min-w-0 flex-1">
            <p
              className="truncate text-sm font-semibold text-foreground cursor-pointer hover:underline"
              onClick={handleClickName}
            >
              {rule.name}
            </p>
            {rule.description && (
              <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                {rule.description}
              </p>
            )}
            {rule.checkScript && (
              <p className="mt-1 rounded bg-muted/50 px-2 py-1 font-mono text-[11px] text-muted-foreground truncate">
                {rule.scriptLanguage ?? "bash"}: {rule.checkScript.split("\n")[0]}
              </p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", c.cls)}>
                {c.label}
              </span>
              {rule.tags.map((tag) => (
                <span
                  key={tag}
                  className="flex items-center gap-0.5 rounded-full bg-muted/50 px-2 py-0.5 text-[10px] text-muted-foreground"
                >
                  <Tag className="h-2.5 w-2.5" />
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-accent"
            title={rule.enabled ? t("rules.disable") : t("rules.enable")}
            onClick={handleToggle}
          >
            {rule.enabled ? (
              <ToggleRight className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ToggleLeft className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
          <button
            className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-accent"
            onClick={handleEdit}
          >
            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
          <button
            className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-destructive/10"
            onClick={handleDelete}
          >
            <Trash2 className="h-3.5 w-3.5 text-red-400" />
          </button>
        </div>
      </div>
    </div>
  );
};
