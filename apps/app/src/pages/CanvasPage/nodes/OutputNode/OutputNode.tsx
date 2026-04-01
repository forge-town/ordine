import { Handle, Position } from "@xyflow/react";
import { LogOut } from "lucide-react";
import type { OutputNodeData } from "../../_store";
import { NodeCard } from "../NodeCard";

export interface OutputNodeProps {
  data: OutputNodeData;
  selected?: boolean;
}

export const OutputNode = ({ data, selected }: OutputNodeProps) => (
  <div className="group relative" style={{ overflow: "visible" }}>
    <NodeCard
      theme="sky"
      icon={LogOut}
      label={data.label}
      description="Output Result"
      selected={selected}
      bodyClassName="space-y-3"
    >
      {data.expectedSchema && (
        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Expected Schema
          </p>
          <p className="font-mono text-[12px] text-slate-600 line-clamp-2 px-1">
            {data.expectedSchema}
          </p>
        </div>
      )}
      {data.notes && (
        <p className="text-[11px] leading-relaxed text-slate-500 line-clamp-2">
          {data.notes}
        </p>
      )}
    </NodeCard>

    <Handle
      type="target"
      position={Position.Left}
      className="absolute h-3.5 w-3.5 rounded-full bg-sky-500 border-[3px] border-white shadow-sm transition-all hover:scale-110 -left-1.5 top-1/2 -mt-1.5"
    />
  </div>
);
