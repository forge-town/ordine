import { Check, LoaderCircle } from "lucide-react";
import { Icon } from "@/components/primitives";

export type ProgressListBadge = {
  label: string;
  tone?: "success" | "accent";
};

export type ProgressListItem = {
  badges?: ProgressListBadge[];
  detail?: string;
  done?: boolean;
  id: string;
  title: string;
};

export type ProgressListProps = {
  items: ProgressListItem[];
  showStatus?: boolean;
};

/** Minimal left-border list — replaces the heavy proposal/progress cards. */
export const ProgressList = ({ items, showStatus = false }: ProgressListProps) => (
  <div
    className="space-y-1 border-l border-border pl-3 text-[11.5px]"
    data-testid="agent-progress-list"
  >
    {items.map((item) => (
      <div key={item.id} className="flex items-center gap-1.5">
        {showStatus ? (
          item.done ? (
            <Icon className="shrink-0 text-success" icon={Check} size={11} />
          ) : (
            <Icon
              className="shrink-0 animate-spin text-muted-foreground"
              icon={LoaderCircle}
              size={11}
            />
          )
        ) : null}
        <span className="font-medium">{item.title}</span>
        {(item.badges ?? []).map((badge) => (
          <span
            key={badge.label}
            className={
              badge.tone === "accent"
                ? "shrink-0 rounded-full bg-foreground/10 px-1.5 py-px text-[9.5px] font-medium text-foreground/80"
                : "shrink-0 rounded-full bg-success/15 px-1.5 py-px text-[9.5px] font-medium text-success"
            }
            data-testid="agent-progress-badge"
          >
            {badge.label}
          </span>
        ))}
        {item.detail ? (
          <span className="truncate text-muted-foreground">— {item.detail}</span>
        ) : null}
      </div>
    ))}
  </div>
);
