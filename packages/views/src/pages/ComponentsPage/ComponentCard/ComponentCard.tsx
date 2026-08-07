import { Pencil, Trash2, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@repo/ui/button";
import { surfaceCardVariants } from "@repo/ui/card";
import { cn } from "@repo/ui/lib/utils";
import { Icon, Tag } from "../../../components/primitives";

export type ComponentCategory = "input" | "operation" | "output" | "pipeline-skill";
export type ComponentSource = "asset" | "builtin" | "operation";

export type ComponentCardItem = {
  id: string;
  category: ComponentCategory;
  description: string;
  icon: LucideIcon;
  io: string;
  meta: string;
  name: string;
  source: ComponentSource;
  stat: string;
  canDelete?: boolean;
  canEdit?: boolean;
};

export type ComponentCardProps = {
  item: ComponentCardItem;
  onDelete: (item: ComponentCardItem) => void;
  onEdit: (item: ComponentCardItem) => void;
};

export const ComponentCard = ({ item, onDelete, onEdit }: ComponentCardProps) => {
  const { t } = useTranslation();
  const isPipelineSkill = item.category === "pipeline-skill";

  return (
    <article
      className={cn(
        surfaceCardVariants({ interactive: true }),
        "group flex min-h-[154px] flex-col p-3.5",
      )}
    >
      <div className="flex items-start gap-2.5">
        <span
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
            isPipelineSkill ? "bg-foreground text-background" : "bg-muted",
          )}
        >
          <Icon
            className={isPipelineSkill ? undefined : "text-foreground/75"}
            icon={item.icon}
            size={14}
          />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[13px] font-semibold">{item.name}</h3>
          <p className="truncate text-[11px] text-muted-foreground">{item.meta}</p>
        </div>
        {(item.canEdit || item.canDelete) && (
          <div className="flex shrink-0 items-center gap-0.5 opacity-100 md:opacity-0 md:transition-opacity md:group-hover:opacity-100 md:group-focus-within:opacity-100">
            {item.canEdit && (
              <Button
                aria-label={t("components.actions.editNamed", { name: item.name })}
                size="icon-sm"
                variant="ghost"
                onClick={() => onEdit(item)}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
            {item.canDelete && (
              <Button
                aria-label={t("components.actions.deleteNamed", { name: item.name })}
                className="hover:bg-destructive/10 hover:text-destructive"
                size="icon-sm"
                variant="ghost"
                onClick={() => onDelete(item)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        )}
      </div>

      <p className="mt-2 line-clamp-2 text-[11.5px] leading-relaxed text-muted-foreground">
        {item.description}
      </p>
      <div className="mt-2.5 truncate rounded-lg bg-surface-2 px-2 py-1.5 font-mono text-[10px] text-muted-foreground">
        {item.io}
      </div>
      <div className="mt-auto flex items-center gap-1.5 pt-2 text-[10.5px] text-muted-foreground">
        <span className="truncate">{item.stat}</span>
        <Tag className="ml-auto shrink-0">{t(`components.sources.${item.source}`)}</Tag>
      </div>
    </article>
  );
};
