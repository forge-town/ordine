import { useState } from "react";
import {
  Plus,
  Zap,
  FileCode,
  Folder,
  HardDrive,
  FolderOutput,
} from "lucide-react";
import { useStore } from "zustand";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui/popover";
import { SiGitHubIcon } from "../GitHubProjectNode/SiGitHubIcon";
import { useHarnessCanvasStore } from "../_store";
import {
  allowedConnections,
  nodeTypeMeta,
  type NodeType,
} from "../nodeSchemas";
import { cn } from "@repo/ui/lib/utils";

const TYPE_ICONS: Record<NodeType | "operation", React.ElementType> = {
  operation: Zap,
  "code-file": FileCode,
  folder: Folder,
  "github-project": SiGitHubIcon,
  "output-project-path": FolderOutput,
  "output-local-path": HardDrive,
};

interface Props {
  nodeId: string;
  nodeType: NodeType;
}

const handleMouseDown = (e: React.MouseEvent) => e.stopPropagation();

export const QuickAddButton = ({ nodeId, nodeType }: Props) => {
  const [open, setOpen] = useState(false);
  const store = useHarnessCanvasStore();
  const addNodeWithEdge = useStore(store, (s) => s.addNodeWithEdge);

  const allowed = allowedConnections[nodeType];
  if (allowed.length === 0) return null;

  const handleAdd = (targetType: NodeType) => {
    addNodeWithEdge(nodeId, targetType);
    setOpen(false);
  };

  const handlePick = (type: NodeType) => (e: React.MouseEvent) => {
    e.stopPropagation();
    handleAdd(type);
  };

  const handleOpenChange = (v: boolean) => setOpen(v);

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        className={cn(
          "flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition-all",
          "hover:bg-slate-100 hover:text-slate-800 hover:scale-110",
        )}
        title="添加连接节点"
        onMouseDown={handleMouseDown}
      >
        <Plus className="h-3 w-3" />
      </PopoverTrigger>

      <PopoverContent
        align="center"
        className="z-200 min-w-32.5 rounded-xl border border-slate-200 bg-white/95 backdrop-blur-md py-1.5 shadow-xl p-0"
        side="right"
      >
        <p className="px-3 pb-1 text-[9px] font-semibold uppercase tracking-widest text-slate-400">
          选择类型
        </p>
        {allowed.map((type) => {
          const Icon = TYPE_ICONS[type];
          const meta = nodeTypeMeta[type];
          return (
            <button
              key={type}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-1.5 text-xs transition-colors hover:bg-gray-50",
              )}
              onClick={handlePick(type)}
              onMouseDown={handleMouseDown}
            >
              <span
                className={cn(
                  "flex h-4 w-4 shrink-0 items-center justify-center rounded",
                  meta.iconBg,
                )}
              >
                <Icon className="h-2.5 w-2.5 text-white" />
              </span>
              {meta.shortLabel}
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
};
