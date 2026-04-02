import { Handle, Position } from "@xyflow/react";
import { Folder } from "lucide-react";
import { useHarnessCanvasStore, type FolderNodeData } from "../../_store";
import { NodeCard } from "../NodeCard";

export interface FolderNodeProps {
  id: string;
  data: FolderNodeData;
  selected?: boolean;
}

export const FolderNode = ({ id, data, selected }: FolderNodeProps) => {
  const store = useHarnessCanvasStore();
  const update = (patch: Record<string, unknown>) =>
    store.getState().updateNodeData(id, patch);
  return (
    <div className="group relative" style={{ overflow: "visible" }}>
      <NodeCard
        theme="orange"
        icon={Folder}
        label={data.label}
        onLabelChange={(v) => update({ label: v })}
        description="Folder"
        selected={selected}
        bodyClassName="space-y-2"
      >
        <div className="flex items-center gap-1.5 rounded-md border border-slate-100 bg-slate-50 px-2.5 py-1">
          <input
            className="nodrag nopan font-mono text-[11px] font-semibold text-slate-700 bg-transparent focus:outline-none flex-1 min-w-0"
            value={data.folderPath}
            onChange={(e) => update({ folderPath: e.target.value })}
            placeholder="src/components/"
            onMouseDown={(e) => e.stopPropagation()}
          />
        </div>
        <textarea
          className="nodrag nopan text-[11px] text-slate-500 bg-transparent w-full resize-none focus:outline-none focus:bg-slate-50 focus:ring-1 focus:ring-slate-200 rounded px-1"
          rows={2}
          value={data.description ?? ""}
          onChange={(e) => update({ description: e.target.value })}
          placeholder="文件夹描述..."
          onMouseDown={(e) => e.stopPropagation()}
        />
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
};
