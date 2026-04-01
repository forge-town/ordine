import { Handle, Position } from "@xyflow/react";
import { LogIn } from "lucide-react";
import type { InputNodeData } from "../../_store";
import { NodeCard } from "../NodeCard";

export interface InputNodeProps {
  data: InputNodeData;
  selected?: boolean;
}

export const InputNode = ({ data, selected }: InputNodeProps) => (
  <div className="group relative" style={{ overflow: "visible" }}>
    <NodeCard
      theme="emerald"
      icon={LogIn}
      label={data.label}
      description="Input Trigger"
      selected={selected}
      bodyClassName="space-y-3"
    >
      <p className="text-[12px] leading-relaxed text-slate-600 line-clamp-2">
        {data.contextDescription}
      </p>
      {data.exampleValue && (
        <p className="font-mono text-[12px] text-slate-500 line-clamp-2 mt-1 px-1">
          {data.exampleValue}
        </p>
      )}
    </NodeCard>
    <Handle
      className="absolute z-10 h-3.5 w-3.5 rounded-full bg-emerald-500 border-[3px] border-white shadow-sm transition-all hover:scale-110 -right-1.5 top-1/2 -mt-1.5"
      type="source"
      position={Position.Right}
    />
  </div>
);
