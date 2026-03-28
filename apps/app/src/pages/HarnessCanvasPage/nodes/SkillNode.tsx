import { Handle, Position } from "@xyflow/react";
import { Wand2, CheckCircle2, XCircle, Loader2, Circle } from "lucide-react";
import type { SkillNodeData, NodeRunStatus } from "../_store";

interface Props {
  data: SkillNodeData;
  selected?: boolean;
}

const statusConfig: Record<
  NodeRunStatus,
  { icon: React.ElementType; color: string; bg: string }
> = {
  idle: { icon: Circle, color: "text-gray-400", bg: "bg-gray-50" },
  running: {
    icon: Loader2,
    color: "text-blue-500 animate-spin",
    bg: "bg-blue-50",
  },
  pass: { icon: CheckCircle2, color: "text-green-500", bg: "bg-green-50" },
  fail: { icon: XCircle, color: "text-red-500", bg: "bg-red-50" },
};

export const SkillNode = ({ data, selected }: Props) => {
  const { icon: StatusIcon, color, bg } = statusConfig[data.status ?? "idle"];

  return (
    <div
      className={[
        "min-w-[200px] max-w-[240px] rounded-xl border-2 bg-white shadow-sm transition-shadow",
        selected
          ? "border-violet-500 shadow-md shadow-violet-100"
          : "border-violet-200 hover:border-violet-400",
      ].join(" ")}
    >
      <div className="flex items-center gap-2 rounded-t-lg bg-violet-50 px-3 py-2">
        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-violet-500">
          <Wand2 className="h-3 w-3 text-white" />
        </div>
        <span className="flex-1 truncate text-xs font-semibold text-violet-700">
          {data.label}
        </span>
        <StatusIcon className={["h-3.5 w-3.5 shrink-0", color].join(" ")} />
      </div>

      <div className="px-3 py-2 space-y-1.5">
        <div className={["rounded px-2 py-0.5", bg].join(" ")}>
          <span className="font-mono text-[10px] font-medium text-gray-600">
            {data.skillName}
          </span>
        </div>

        {data.acceptanceCriteria && (
          <div className="rounded border border-amber-100 bg-amber-50 px-2 py-1">
            <p className="text-[10px] text-amber-700 line-clamp-2">
              ✓ {data.acceptanceCriteria}
            </p>
          </div>
        )}
      </div>

      <Handle
        type="target"
        position={Position.Left}
        className="!h-3 !w-3 !border-2 !border-violet-400 !bg-white"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!h-3 !w-3 !border-2 !border-violet-400 !bg-white"
      />
    </div>
  );
};
