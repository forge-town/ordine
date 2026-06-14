import { GitBranch, Pencil, Trash2, type LucideIcon } from "lucide-react";
import { Button } from "@repo/ui/button";
import { cn } from "@repo/ui/lib/utils";
import { Icon, Tag } from "@/components/primitives";

export type ComponentCategory = "Input Objects" | "Operations" | "Output" | "Pipeline Skill";

export type ComponentCardItem = {
  id: string;
  category: ComponentCategory;
  description: string;
  icon: LucideIcon;
  io: string;
  meta: string;
  name: string;
  usageCount: number;
  source: "asset" | "template";
};

export type ComponentCardProps = {
  item: ComponentCardItem;
  onDelete: (item: ComponentCardItem) => void;
  onEdit: (item: ComponentCardItem) => void;
};

export const ComponentCard = ({ item, onDelete, onEdit }: ComponentCardProps) => {
  const isPipelineSkill = item.category === "Pipeline Skill";
  const handleEditClick = () => onEdit(item);
  const handleDeleteClick = () => onDelete(item);

  return (
    <div className="group flex min-h-[154px] flex-col rounded-2xl bg-surface p-3.5 ring-1 ring-border shadow-soft transition-all hover:shadow-float hover:ring-border-strong">
      <div className="flex items-start gap-2.5">
        <span
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
            isPipelineSkill ? "bg-foreground text-primary-foreground" : "bg-surface-2",
          )}
        >
          <Icon
            className={isPipelineSkill ? undefined : "text-foreground/75"}
            icon={item.icon}
            size={14}
          />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12.5px] font-semibold tracking-tightish">{item.name}</div>
          <div className="truncate text-[10.5px] text-muted-foreground">{item.meta}</div>
        </div>
        <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <Button
            aria-label={`Edit ${item.name}`}
            size="icon-sm"
            variant="ghost"
            onClick={handleEditClick}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            aria-label={`Delete ${item.name}`}
            className="hover:bg-destructive/10 hover:text-destructive"
            size="icon-sm"
            variant="ghost"
            onClick={handleDeleteClick}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <p className="mt-2 line-clamp-2 text-[11.5px] leading-relaxed text-muted-foreground">
        {item.description}
      </p>
      <div className="mt-2.5 truncate rounded-lg bg-surface-2 px-2 py-1.5 font-mono text-[10px] text-muted-foreground">
        {item.io}
      </div>
      <div className="mt-auto flex items-center gap-1.5 pt-2 text-[10.5px] text-muted-foreground">
        <GitBranch className="h-3 w-3" />
        used in {item.usageCount} pipeline{item.usageCount === 1 ? "" : "s"}
        <Tag className="ml-auto">{item.source}</Tag>
      </div>
    </div>
  );
};
