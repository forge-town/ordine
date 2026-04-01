import { Handle, Position } from "@xyflow/react";
import { Folder } from "lucide-react";
import type { FolderNodeData } from "../../_store";
import { NodeCard } from "../NodeCard";

export interface FolderNodeProps {
  data: FolderNodeData;
  selected?: boolean;
}

export const FolderNode = ({ data, selected }: FolderNodeProps) => (
  <div className="group relative" style={{ overflow: "visible" }}>
    <NodeCard
      theme="orange"
      icon={Folder}
      label={data.label}
      description="Folder"
      selected={selected}
      bodyClassName="space-y-2"
    >
      <div className="flex items-center gap-1.5 rounded-md border border-slate-100 bg-slate-50 px-2.5 py-1.5">
        <span className="font-mono text-[11px] font-semibold text-slate-700 truncate">
          {data.folderPath || (
            <span className="font-normal text-slate-400">未设置路径</span>
          )}
        </span>
      </div>
      {data.description && (
        <p className="text-[11px] leading-relaxed text-slate-500 line-clamp-2">
          {data.description}
        </p>
      )}
    </NodeCard>

    <Handle
      type="target"
      position={Position.Left}
      className="absolute h-3.5 w-3.5 rounded-full bg-orange-400 border-[3px] border-white shadow-sm transition-all hover:scale-110 -left-1.5 top-1/2 -mt-1.5"
    />
    <Handle
      type="source"
      position={Position.Right}
      className="absolute h-3.5 w-3.5 rounded-full bg-orange-400 border-[3px] border-white shadow-sm transition-all hover:scale-110 -right-1.5 top-1/2 -mt-1.5"
    />
  </div>
);
