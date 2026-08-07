import { Cpu, Trash2, Wand2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@repo/ui/button";
import { cn } from "@repo/ui/lib/utils";
import { Tag } from "../../components/primitives";

export type SkillCardItem = {
  id: string;
  description: string;
  io: string;
  name: string;
  operation: string;
  source: string;
  sourceCaption: string;
  sourceTone: "blue" | "green" | "neutral" | "orange" | "purple";
  tags: string[];
  title: string;
};

export type SkillCardProps = {
  item: SkillCardItem;
  onCreateOperation: (skillId: string) => void;
  onDelete: (skillId: string) => void;
};

const sourceToneClass: Record<SkillCardItem["sourceTone"], string> = {
  blue: "bg-sky-100 text-sky-700",
  green: "bg-emerald-100 text-emerald-700",
  neutral: "bg-surface-2 text-muted-foreground",
  orange: "bg-amber-100 text-amber-700",
  purple: "bg-violet-100 text-violet-700",
};

export const SkillCard = ({ item, onCreateOperation, onDelete }: SkillCardProps) => {
  const { t } = useTranslation();
  const handleCreateOperationClick = () => onCreateOperation(item.id);
  const handleDeleteClick = () => onDelete(item.id);

  return (
    <article className="group flex min-h-[186px] flex-col rounded-lg bg-surface p-3.5 shadow-soft ring-1 ring-border transition-shadow hover:shadow-float hover:ring-border-strong">
      <div className="flex items-start gap-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-2">
          <Wand2 className="size-3.5 text-foreground/75" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-mono text-[12.5px] font-semibold">{item.name}</div>
          <div className="truncate text-[10.5px] text-muted-foreground">{item.sourceCaption}</div>
        </div>
        <Tag className={cn("font-sans", sourceToneClass[item.sourceTone])}>{item.source}</Tag>
      </div>

      <h3 className="mt-3 truncate text-[13px] font-semibold text-foreground">{item.title}</h3>
      <p className="mt-1 line-clamp-2 text-[11.5px] leading-relaxed text-muted-foreground">
        {item.description}
      </p>
      <div className="mt-2.5 truncate rounded-lg bg-surface-2 px-2 py-1.5 font-mono text-[10px] text-muted-foreground">
        {item.io}
      </div>
      {item.tags.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {item.tags.slice(0, 4).map((tag) => (
            <Tag key={tag}>{tag}</Tag>
          ))}
        </div>
      ) : null}

      <div className="mt-auto flex items-center gap-1.5 pt-2.5 text-[10.5px] text-muted-foreground">
        <Cpu className="size-3" />
        <span className="min-w-0 truncate">
          {t("skills.powers", { operation: item.operation })}
        </span>
        <div className="ml-auto flex items-center gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
          <Button
            aria-label={t("skills.createFrom", { name: item.name })}
            size="icon-sm"
            variant="ghost"
            onClick={handleCreateOperationClick}
          >
            <Cpu className="size-3.5" />
          </Button>
          <Button
            aria-label={t("skills.deleteSkill", { name: item.name })}
            className="hover:bg-destructive/10 hover:text-destructive"
            size="icon-sm"
            variant="ghost"
            onClick={handleDeleteClick}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>
    </article>
  );
};
