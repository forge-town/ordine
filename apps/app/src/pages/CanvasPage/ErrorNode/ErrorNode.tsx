import { Handle, Position } from "@xyflow/react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";

export interface ErrorNodeProps {
  id: string;
  type?: string;
  data: Record<string, unknown>;
  selected?: boolean;
}

export const ErrorNode = ({ id, type, selected }: ErrorNodeProps) => {
  return (
    <div
      className={cn(
        "rounded-lg border-2 bg-red-50 px-4 py-3 shadow-sm transition-all duration-200",
        selected ? "border-red-500 shadow-md" : "border-red-300",
      )}
      style={{ minWidth: 200 }}
    >
      <Handle
        className="!bg-red-400 !w-3 !h-3"
        position={Position.Left}
        type="target"
      />

      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-red-100">
          <AlertTriangle className="h-4 w-4 text-red-600" />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-xs font-semibold text-red-700">未知节点</span>
          <span className="text-[10px] text-red-400 truncate">
            type: {type ?? "undefined"} | id: {id}
          </span>
        </div>
      </div>

      <Handle
        className="!bg-red-400 !w-3 !h-3"
        position={Position.Right}
        type="source"
      />
    </div>
  );
};
