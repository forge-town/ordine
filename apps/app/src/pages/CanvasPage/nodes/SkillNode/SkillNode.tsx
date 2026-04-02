import { Handle, Position } from "@xyflow/react";
import { Wand2, CheckCircle2, XCircle, Loader2, Circle } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import {
  useHarnessCanvasStore,
  type SkillNodeData,
  type NodeRunStatus,
} from "../../_store";
import { NodeCard } from "../NodeCard";

export interface SkillNodeProps {
  id: string;
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

export const SkillNode = ({ id, data, selected }: SkillNodeProps) => {
  const store = useHarnessCanvasStore();
  const update = (patch: Record<string, unknown>) =>
    store.getState().updateNodeData(id, patch);
  const { icon: StatusIcon, color, bg } = statusConfig[data.status ?? "idle"];

  return (
    <div className="group relative" style={{ overflow: "visible" }}>
      <NodeCard
        theme="violet"
        icon={Wand2}
        label={data.label}
        onLabelChange={(v) => update({ label: v })}
        description="Skill Node"
        selected={selected}
        headerRight={<StatusIcon className={cn("h-4 w-4 shrink-0", color)} />}
        bodyClassName="space-y-3"
      >
        <div
          className={cn(
            "flex w-full items-center rounded-md border border-slate-100 px-3 py-1.5",
            bg,
          )}
        >
          <input
            className="nodrag nopan font-mono text-[11px] font-semibold text-slate-700 bg-transparent focus:outline-none w-full min-w-0"
            value={data.skillName}
            onChange={(e) => update({ skillName: e.target.value })}
            placeholder="未设置 skill"
            onMouseDown={(e) => e.stopPropagation()}
          />
        </div>
        <div className="rounded-md border border-amber-200/60 bg-amber-50/50 p-2 relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-amber-400" />
          <textarea
            className="nodrag nopan w-full bg-transparent text-[11px] leading-relaxed text-amber-900/80 resize-none focus:outline-none"
            rows={2}
            value={data.acceptanceCriteria ?? ""}
            onChange={(e) => update({ acceptanceCriteria: e.target.value })}
            placeholder="AC: 验收条件..."
            onMouseDown={(e) => e.stopPropagation()}
          />
        </div>
      </NodeCard>

      <Handle
        type="target"
        position={Position.Left}
        className="absolute h-3.5 w-3.5 rounded-full bg-violet-500 border-[3px] border-white shadow-sm transition-all hover:scale-110 -left-1.5 top-1/2 -mt-1.5"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="absolute h-3.5 w-3.5 rounded-full bg-violet-500 border-[3px] border-white shadow-sm transition-all hover:scale-110 -right-1.5 top-1/2 -mt-1.5"
      />
    </div>
  );
};
