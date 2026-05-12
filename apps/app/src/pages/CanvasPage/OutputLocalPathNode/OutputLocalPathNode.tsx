import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, FolderOpen, HardDrive } from "lucide-react";
import { OUTPUT_MODE_ENUM, type OutputMode, type LocalPathOutputNodeData } from "@repo/schemas";
import { useStore } from "zustand";
import { useShallow } from "zustand/shallow";
import { useHarnessCanvasStore, selectNodeRunState, selectNodePortCounts } from "../_store";
import { NodeCard } from "../NodeCard";
import { FolderBrowser } from "@/components/FolderBrowser/FolderBrowser";

export interface OutputLocalPathNodeProps {
  id: string;
  data: LocalPathOutputNodeData;
  selected?: boolean;
}

const handleStopPropagation = (e: React.SyntheticEvent) => e.stopPropagation();

const MODE_LABEL_KEYS: Record<OutputMode, string> = {
  overwrite: "nodes.outputLocalPathNode.modeOverwrite",
  error_if_exists: "nodes.outputLocalPathNode.modeErrorIfExists",
  auto_rename: "nodes.outputLocalPathNode.modeAutoRename",
};

export const OutputLocalPathNode = ({ id, data, selected }: OutputLocalPathNodeProps) => {
  const { t } = useTranslation();
  const store = useHarnessCanvasStore();
  const { runStatus, dimmed } = useStore(store, useShallow(selectNodeRunState(id)));
  const updateNodeData = useStore(store, (s) => s.updateNodeData);
  const {
    leftActivePortCount,
    leftActivePortMask,
    leftConnectedPortCount,
    leftConnectedPortMask,
    leftPortCount,
  } = useStore(store, useShallow(selectNodePortCounts(id)));
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
        leftHandle
        bodyClassName="space-y-2"
        description={t("nodes.outputLocalPathNode.description")}
        dimmed={dimmed}
        icon={HardDrive}
        label={data.label}
        leftActivePortCount={leftActivePortCount}
        leftActivePortMask={leftActivePortMask}
        leftConnectedPortCount={leftConnectedPortCount}
        leftConnectedPortMask={leftConnectedPortMask}
        leftHandleCount={leftPortCount}
        runStatus={runStatus}
        selected={selected}
        theme="teal"
        onLabelChange={handleLabelChange}
      >
        <div className="flex items-center gap-1 rounded-md border border-teal-100 bg-teal-50 px-2 py-1">
          <span className="shrink-0 text-[10px] font-medium text-teal-500">
            {t("nodes.outputLocalPathNode.pathLabel")}
          </span>
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
            title={t("nodes.outputLocalPathNode.browseFolder")}
            type="button"
            onClick={handleFolderButtonClick}
            onMouseDown={handleStopPropagation}
          >
            <FolderOpen className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-1 rounded-md border border-teal-100 bg-teal-50 px-2 py-1">
          <span className="shrink-0 text-[10px] font-medium text-teal-500">
            {t("nodes.outputLocalPathNode.filenameLabel")}
          </span>
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
          <span className="shrink-0 text-[10px] font-medium text-teal-500">
            {t("nodes.outputLocalPathNode.writeModeLabel")}
          </span>
          <select
            className="nodrag nopan flex-1 min-w-0 bg-transparent text-[11px] font-semibold text-teal-800 focus:outline-none cursor-pointer"
            value={currentMode}
            onChange={handleModeChange}
            onClick={handleStopPropagation}
            onMouseDown={handleStopPropagation}
          >
            {Object.values(OUTPUT_MODE_ENUM).map((mode) => (
              <option key={mode} value={mode}>
                {t(MODE_LABEL_KEYS[mode])}
              </option>
            ))}
          </select>
        </div>

        {currentMode === "error_if_exists" && (
          <div className="flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] text-amber-700">
            <AlertTriangle className="h-3 w-3 shrink-0" />
            <span>{t("nodes.outputLocalPathNode.errorIfExistsWarning")}</span>
          </div>
        )}

        <textarea
          className="nodrag nopan text-[11px] text-slate-500 bg-transparent w-full resize-none focus:outline-none focus:bg-slate-50 focus:ring-1 focus:ring-slate-200 rounded px-1"
          placeholder={t("nodes.outputLocalPathNode.descriptionPlaceholder")}
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
    </div>
  );
};
