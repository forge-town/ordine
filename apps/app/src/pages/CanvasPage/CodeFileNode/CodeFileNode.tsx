import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FileCode, FolderOpen } from "lucide-react";
import { useStore } from "zustand";
import { useShallow } from "zustand/shallow";
import { useCanvasPageStore, selectNodeRunState, selectNodePortCounts } from "../_store";
import type { FileObjectNodeData } from "@repo/schemas";
import { NodeCard } from "../NodeCard";
import { FolderBrowser } from "@/components/FolderBrowser/FolderBrowser";

export interface FileNodeProps {
  id: string;
  data: FileObjectNodeData;
  selected?: boolean;
}

const handleStopPropagation = (e: React.SyntheticEvent) => e.stopPropagation();

export const FileNode = ({ id, data, selected }: FileNodeProps) => {
  const { t } = useTranslation();
  const store = useCanvasPageStore();
  const { runStatus, dimmed } = useStore(store, useShallow(selectNodeRunState(id)));
  const updateNodeData = useStore(store, (s) => s.updateNodeData);
  const {
    rightActivePortCount,
    rightActivePortMask,
    rightConnectedPortCount,
    rightConnectedPortMask,
    rightPortCount,
  } = useStore(store, useShallow(selectNodePortCounts(id)));
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
    <div className="group relative overflow-visible">
      <NodeCard
        rightHandle
        bodyClassName="space-y-2"
        description={t("canvas.nodeTypes.file.label")}
        dimmed={dimmed}
        icon={FileCode}
        label={data.label}
        rightActivePortCount={rightActivePortCount}
        rightActivePortMask={rightActivePortMask}
        rightConnectedPortCount={rightConnectedPortCount}
        rightConnectedPortMask={rightConnectedPortMask}
        rightHandleCount={rightPortCount}
        runStatus={runStatus}
        selected={selected}
        theme="orange"
        onLabelChange={handleLabelChange}
      >
        <div className="flex items-center gap-1 rounded-md border border-slate-100 bg-slate-50 px-2 py-1">
          <input
            aria-label={t("nodes.codeFile.pathLabel")}
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
            title={t("nodes.codeFile.browseFile")}
            type="button"
            onClick={handleBrowseButtonClick}
            onMouseDown={handleStopPropagation}
          >
            <FolderOpen className="h-3.5 w-3.5" />
          </button>
          <input
            aria-label={t("nodes.codeFile.languageLabel")}
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
          aria-label={t("nodes.codeFile.descriptionLabel")}
          className="nodrag nopan text-[11px] text-slate-500 bg-transparent w-full resize-none focus:outline-none focus:bg-slate-50 focus:ring-1 focus:ring-slate-200 rounded px-1"
          name={`${id}-description`}
          placeholder={t("nodes.codeFile.descriptionPlaceholder")}
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
