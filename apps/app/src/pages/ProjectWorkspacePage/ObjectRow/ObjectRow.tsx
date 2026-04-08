import {
  FileCode,
  Folder,
  FolderGit2,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import type { WorkObject } from "@/models/daos/worksDao";

export type ObjectItem = {
  type: WorkObject["type"];
  path: string;
  label: string;
};

const OBJECT_ICONS: Record<WorkObject["type"], React.ElementType> = {
  project: FolderGit2,
  folder: Folder,
  file: FileCode,
};

export type ObjectRowProps = {
  item: ObjectItem;
  selected: boolean;
  onToggle: () => void;
};

export const ObjectRow = ({ item, selected, onToggle }: ObjectRowProps) => {
  const Icon = OBJECT_ICONS[item.type];
  return (
    <button
      className={cn(
        "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
        selected
          ? "border-primary/50 bg-primary/5"
          : "border-border bg-card hover:border-primary/50 hover:bg-accent",
      )}
      onClick={onToggle}
    >
      <span
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded",
          item.type === "project" && "bg-gray-900",
          item.type === "folder" && "bg-orange-400",
          item.type === "file" && "bg-orange-500",
        )}
      >
        <Icon className="h-3.5 w-3.5 text-white" />
      </span>
      <span className="flex-1 truncate font-mono text-xs text-foreground">
        {item.label}
      </span>
      {selected ? (
        <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
      ) : (
        <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />
      )}
    </button>
  );
};
