import { Handle, Position } from "@xyflow/react";
import { FileCode } from "lucide-react";
import { useHarnessCanvasStore, type CodeFileNodeData } from "../../_store";
import { NodeCard } from "../NodeCard";

export interface CodeFileNodeProps {
  id: string;
  data: CodeFileNodeData;
  selected?: boolean;
}

const handleMouseDown = (e: React.MouseEvent) => e.stopPropagation();

export const CodeFileNode = ({ id, data, selected }: CodeFileNodeProps) => {
  const store = useHarnessCanvasStore();
  const update = (patch: Record<string, unknown>) =>
    store.getState().updateNodeData(id, patch);

  const handleLabelChange = (v: string) => update({ label: v });
  const handleFilePathChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    update({ filePath: e.target.value });
  const handleLanguageChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    update({ language: e.target.value });
  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) =>
    update({ description: e.target.value });

  return (
    <div className="group relative" style={{ overflow: "visible" }}>
      <NodeCard
        theme="orange"
        icon={FileCode}
        label={data.label}
        onLabelChange={handleLabelChange}
        description="Code File"
        selected={selected}
        bodyClassName="space-y-2"
      >
        <div className="flex items-center gap-1 rounded-md border border-slate-100 bg-slate-50 px-2.5 py-1">
          <input
            className="nodrag nopan font-mono text-[11px] font-semibold text-slate-700 bg-transparent focus:outline-none flex-1 min-w-0"
            value={data.filePath}
            onChange={handleFilePathChange}
            placeholder="src/file.tsx"
            onMouseDown={handleMouseDown}
          />
          <input
            className="nodrag nopan w-12 shrink-0 rounded bg-orange-100 px-1 py-0.5 font-mono text-[10px] font-medium text-orange-700 focus:outline-none focus:bg-orange-50 text-right"
            value={data.language ?? ""}
            onChange={handleLanguageChange}
            placeholder="ts"
            onMouseDown={handleMouseDown}
          />
        </div>
        <textarea
          className="nodrag nopan text-[11px] text-slate-500 bg-transparent w-full resize-none focus:outline-none focus:bg-slate-50 focus:ring-1 focus:ring-slate-200 rounded px-1"
          rows={2}
          value={data.description ?? ""}
          onChange={handleDescriptionChange}
          placeholder="文件描述..."
          onMouseDown={handleMouseDown}
        />
      </NodeCard>

      {/* Object nodes only emit connections — no target handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="absolute h-3.5 w-3.5 rounded-full bg-orange-500 border-[3px] border-white shadow-sm transition-all hover:scale-110 -right-1.5 top-1/2 -mt-1.5"
      />
    </div>
  );
};
