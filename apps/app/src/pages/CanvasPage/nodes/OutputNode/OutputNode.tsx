import { Handle, Position } from "@xyflow/react";
import { LogOut } from "lucide-react";
import { useHarnessCanvasStore, type OutputNodeData } from "../../_store";
import { NodeCard } from "../NodeCard";

export interface OutputNodeProps {
  id: string;
  data: OutputNodeData;
  selected?: boolean;
}

export const OutputNode = ({ id, data, selected }: OutputNodeProps) => {
  const store = useHarnessCanvasStore();
  const update = (patch: Record<string, unknown>) =>
    store.getState().updateNodeData(id, patch);
  return (
    <div className="group relative" style={{ overflow: "visible" }}>
      <NodeCard
        theme="sky"
        icon={LogOut}
        label={data.label}
        onLabelChange={(v) => update({ label: v })}
        description="Output Result"
        selected={selected}
        bodyClassName="space-y-3"
      >
        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Expected Schema
          </p>
          <textarea
            className="nodrag nopan font-mono text-[11px] text-slate-600 bg-slate-50 rounded px-1 py-0.5 w-full resize-none focus:outline-none focus:ring-1 focus:ring-slate-200"
            rows={2}
            value={data.expectedSchema ?? ""}
            onChange={(e) => update({ expectedSchema: e.target.value })}
            placeholder="{ files: string[] }"
            onMouseDown={(e) => e.stopPropagation()}
          />
        </div>
        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Notes
          </p>
          <textarea
            className="nodrag nopan text-[11px] text-slate-500 bg-slate-50 rounded px-1 py-0.5 w-full resize-none focus:outline-none focus:ring-1 focus:ring-slate-200"
            rows={2}
            value={data.notes ?? ""}
            onChange={(e) => update({ notes: e.target.value })}
            placeholder="备注..."
            onMouseDown={(e) => e.stopPropagation()}
          />
        </div>
      </NodeCard>

      <Handle
        type="target"
        position={Position.Left}
        className="absolute h-3.5 w-3.5 rounded-full bg-sky-500 border-[3px] border-white shadow-sm transition-all hover:scale-110 -left-1.5 top-1/2 -mt-1.5"
      />
    </div>
  );
};
