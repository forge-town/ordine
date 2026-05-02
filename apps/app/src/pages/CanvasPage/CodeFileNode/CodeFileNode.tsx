import { useState } from "react";
import { FileCode, FolderOpen } from "lucide-react";
import { useStore } from "zustand";
import { useShallow } from "zustand/shallow";
import { useHarnessCanvasStore, selectNodeRunState } from "../_store";
import type { CodeFileNodeData } from "@repo/pipeline-engine/schemas";
import { NodeCard, useNodePortCounts } from "../NodeCard";
import { FolderBrowser } from "../OutputLocalPathNode/FolderBrowser";

export interface CodeFileNodeProps {
  id: string;
  data: CodeFileNodeData;
  selected?: boolean;
}

const handleStopPropagation = (e: React.SyntheticEvent) => e.stopPropagation();

export const CodeFileNode = ({ id, data, selected }: CodeFileNodeProps) => {
  const store = useHarnessCanvasStore();
  const { runStatus, dimmed } = useStore(store, useShallow(selectNodeRunState(id)));
  const updateNodeData = useStore(store, (s) => s.updateNodeData);
  const { rightPortCount } = useNodePortCounts(id);
  const [browserOpen, setBrowserOpen] = useState(false);

  const handleLabelChange = (v: string) => updateNodeData(id, { label: v });
  const handleFilePathChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    updateNodeData(id, { filePath: e.target.value });
  const handleLanguageChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    updateNodeData(id, { language: e.target.value });
  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) =>
    updateNodeData(id, { description: e.target.value });

  const handleBrowseButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setBrowserOpen(true);
  };

  const handleFileSelect = (path: string) => {
    updateNodeData(id, { filePath: path });
  };

  const handleBrowserOpenChange = (open: boolean) => {
    setBrowserOpen(open);
  };

  return (
    <div className="group relative" style={{ overflow: "visible" }}>
      <NodeCard
        rightHandle
        bodyClassName="space-y-2"
        description="Code File"
        dimmed={dimmed}
        icon={FileCode}
        label={data.label}
        rightHandleCount={rightPortCount}
        runStatus={runStatus}
        selected={selected}
        theme="orange"
        onLabelChange={handleLabelChange}
      >
        <div className="flex items-center gap-1 rounded-md border border-slate-100 bg-slate-50 px-2 py-1">
          <input
            aria-label="Code file path"
            className="nodrag nopan font-mono text-[11px] font-semibold text-slate-700 bg-transparent focus:outline-none flex-1 min-w-0"
            name={`${id}-filePath`}
            placeholder="src/file.tsx"
            value={data.filePath}
            onChange={handleFilePathChange}
            onClick={handleStopPropagation}
            onKeyDown={handleStopPropagation}
            onMouseDown={handleStopPropagation}
          />
          <button
            className="nodrag nopan shrink-0 rounded p-0.5 text-orange-400 hover:bg-orange-100 hover:text-orange-700 transition-colors"
            title="浏览文件"
            type="button"
            onClick={handleBrowseButtonClick}
            onMouseDown={handleStopPropagation}
          >
            <FolderOpen className="h-3.5 w-3.5" />
          </button>
          <input
            aria-label="Code file language"
            className="nodrag nopan w-12 shrink-0 rounded bg-orange-100 px-1 py-0.5 font-mono text-[10px] font-medium text-orange-700 focus:outline-none focus:bg-orange-50 text-right"
            name={`${id}-language`}
            placeholder="ts"
            value={data.language ?? ""}
            onChange={handleLanguageChange}
            onClick={handleStopPropagation}
            onKeyDown={handleStopPropagation}
            onMouseDown={handleStopPropagation}
          />
        </div>
        <textarea
          aria-label="Code file description"
          className="nodrag nopan text-[11px] text-slate-500 bg-transparent w-full resize-none focus:outline-none focus:bg-slate-50 focus:ring-1 focus:ring-slate-200 rounded px-1"
          name={`${id}-description`}
          placeholder="文件描述..."
          rows={2}
          value={data.description ?? ""}
          onChange={handleDescriptionChange}
          onMouseDown={handleStopPropagation}
        />
      </NodeCard>

      <FolderBrowser
        mode="file"
        open={browserOpen}
        onOpenChange={handleBrowserOpenChange}
        onSelect={handleFileSelect}
      />
    </div>
  );
};
