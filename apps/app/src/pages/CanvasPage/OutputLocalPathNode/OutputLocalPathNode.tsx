import { useState } from "react";
import { Handle, Position } from "@xyflow/react";
import { AlertTriangle, FolderOpen, HardDrive } from "lucide-react";
import { OUTPUT_MODES, type OutputMode } from "@repo/pipeline-engine";
import { useStore } from "zustand";
import { useHarnessCanvasStore, type OutputLocalPathNodeData } from "../_store";
import { NodeCard } from "../NodeCard";
import { useNodeRunState } from "../useNodeRunState";
import { FolderBrowser } from "./FolderBrowser";

export interface OutputLocalPathNodeProps {
  id: string;
  data: OutputLocalPathNodeData;
  selected?: boolean;
}

const handleStopPropagation = (e: React.SyntheticEvent) => e.stopPropagation();

const MODE_LABELS: Record<OutputMode, string> = {
  overwrite: "覆写",
  error_if_exists: "已存在则中断",
  auto_rename: "自动重命名",
};

export const OutputLocalPathNode = ({ id, data, selected }: OutputLocalPathNodeProps) => {
  const { runStatus, dimmed } = useNodeRunState(id);
  const store = useHarnessCanvasStore();
  const updateNodeData = useStore(store, (s) => s.updateNodeData);
  const [browserOpen, setBrowserOpen] = useState(false);

  const handleLabelChange = (v: string) => updateNodeData(id, { label: v });
  const handleLocalPathChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    updateNodeData(id, { localPath: e.target.value });
  const handleFileNameChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    updateNodeData(id, { outputFileName: e.target.value });
  const handleModeChange = (e: React.ChangeEvent<HTMLSelectElement>) =>
    updateNodeData(id, { outputMode: e.target.value as OutputMode });
  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) =>
    updateNodeData(id, { description: e.target.value });

  const handleFolderButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setBrowserOpen(true);
  };

  const handleFolderSelect = (path: string) => {
    updateNodeData(id, { localPath: path });
  };

  const handleBrowserOpenChange = (open: boolean) => {
    setBrowserOpen(open);
  };

  const currentMode = data.outputMode ?? "overwrite";

  return (
    <div className="group relative" style={{ overflow: "visible" }}>
      <NodeCard
        bodyClassName="space-y-2"
        description="本地路径输出"
        dimmed={dimmed}
        icon={HardDrive}
        label={data.label}
        runStatus={runStatus}
        selected={selected}
        theme="teal"
        onLabelChange={handleLabelChange}
      >
        <div className="flex items-center gap-1 rounded-md border border-teal-100 bg-teal-50 px-2 py-1">
          <span className="shrink-0 text-[10px] font-medium text-teal-500">路径</span>
          <input
            className="nodrag nopan flex-1 min-w-0 bg-transparent font-mono text-[11px] font-semibold text-teal-800 focus:outline-none"
            placeholder="/Users/you/Desktop/output"
            value={data.localPath}
            onChange={handleLocalPathChange}
            onClick={handleStopPropagation}
            onKeyDown={handleStopPropagation}
            onMouseDown={handleStopPropagation}
          />
          <button
            className="nodrag nopan shrink-0 rounded p-0.5 text-teal-400 hover:bg-teal-100 hover:text-teal-700 transition-colors"
            title="浏览文件夹"
            type="button"
            onClick={handleFolderButtonClick}
            onMouseDown={handleStopPropagation}
          >
            <FolderOpen className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-1 rounded-md border border-teal-100 bg-teal-50 px-2 py-1">
          <span className="shrink-0 text-[10px] font-medium text-teal-500">文件名</span>
          <input
            className="nodrag nopan flex-1 min-w-0 bg-transparent font-mono text-[11px] font-semibold text-teal-800 focus:outline-none"
            placeholder="output.md"
            value={data.outputFileName ?? ""}
            onChange={handleFileNameChange}
            onClick={handleStopPropagation}
            onKeyDown={handleStopPropagation}
            onMouseDown={handleStopPropagation}
          />
        </div>

        <div className="flex items-center gap-1 rounded-md border border-teal-100 bg-teal-50 px-2 py-1">
          <span className="shrink-0 text-[10px] font-medium text-teal-500">写入模式</span>
          <select
            className="nodrag nopan flex-1 min-w-0 bg-transparent text-[11px] font-semibold text-teal-800 focus:outline-none cursor-pointer"
            value={currentMode}
            onChange={handleModeChange}
            onClick={handleStopPropagation}
            onMouseDown={handleStopPropagation}
          >
            {OUTPUT_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {MODE_LABELS[mode]}
              </option>
            ))}
          </select>
        </div>

        {currentMode === "error_if_exists" && (
          <div className="flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] text-amber-700">
            <AlertTriangle className="h-3 w-3 shrink-0" />
            <span>如果输出文件已存在，管线将会中断</span>
          </div>
        )}

        <textarea
          className="nodrag nopan text-[11px] text-slate-500 bg-transparent w-full resize-none focus:outline-none focus:bg-slate-50 focus:ring-1 focus:ring-slate-200 rounded px-1"
          placeholder="描述此输出..."
          rows={2}
          value={data.description ?? ""}
          onChange={handleDescriptionChange}
          onMouseDown={handleStopPropagation}
        />
      </NodeCard>

      <FolderBrowser
        open={browserOpen}
        onOpenChange={handleBrowserOpenChange}
        onSelect={handleFolderSelect}
      />

      {/* Output nodes only receive connections — no source handle */}
      <Handle
        className="absolute h-3.5 w-3.5 rounded-full bg-teal-600 border-[3px] border-white shadow-sm transition-all hover:scale-110 -left-1.5 top-1/2 -mt-1.5"
        position={Position.Left}
        type="target"
      />
    </div>
  );
};
