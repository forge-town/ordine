import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FileCode, FolderOpen } from "lucide-react";
import { useStore } from "zustand";
import { useShallow } from "zustand/shallow";
import { useCanvasPageStore, selectNodeRunState, selectNodePortCounts } from "../_store";
import type { FileObjectNodeData } from "@repo/schemas";
import { NodeCard } from "../NodeCard";
import { FolderBrowserDialog } from "../../../components/FolderBrowserDialog/FolderBrowserDialog";

export interface FileNodeProps {
  id: string;
  data: FileObjectNodeData;
  selected?: boolean;
}

const handleStopPropagation = (e: React.SyntheticEvent) => e.stopPropagation();

export const FileNode = ({ id, data, selected }: FileNodeProps) => {
  const { t } = useTranslation();
  const store = useCanvasPageStore();
  const {
    runStatus,
    dimmed,
    nodeCardMode,
    handleFileLabelChange: applyFileLabelChange,
    handleFilePathChange: applyFilePathChange,
    handleFilePathInputChange: applyFilePathInputChange,
    handleFileLanguageInputChange: applyFileLanguageInputChange,
    handleFileDescriptionInputChange: applyFileDescriptionInputChange,
    rightPortCount,
  } = useStore(
    store,
    useShallow((s) => ({
      ...selectNodeRunState(id)(s),
      nodeCardMode: s.nodeCardMode,
      handleFileLabelChange: s.handleFileLabelChange,
      handleFilePathChange: s.handleFilePathChange,
      handleFilePathInputChange: s.handleFilePathInputChange,
      handleFileLanguageInputChange: s.handleFileLanguageInputChange,
      handleFileDescriptionInputChange: s.handleFileDescriptionInputChange,
      ...selectNodePortCounts(id)(s),
    })),
  );
  const [browserOpen, setBrowserOpen] = useState(false);

  const handleBrowseButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setBrowserOpen(true);
  };

  const handleLabelChange = applyFileLabelChange.bind(null, id);

  const handleFileSelect = applyFilePathChange.bind(null, id);

  const handleFilePathInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    applyFilePathInputChange(id, e.target.value);
  };

  const handleFileLanguageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    applyFileLanguageInputChange(id, e.target.value);
  };

  const handleFileDescriptionInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    applyFileDescriptionInputChange(id, e.target.value);
  };

  const handleBrowserOpenChange = (open: boolean) => {
    setBrowserOpen(open);
  };

  return (
    <div className="group relative w-fit overflow-visible">
      <NodeCard
        rightHandle
        bodyClassName="space-y-2"
        compact={nodeCardMode === "compact"}
        description={t("canvas.nodeTypes.file.label")}
        dimmed={dimmed}
        icon={FileCode}
        label={data.label}
        rightHandleCount={rightPortCount}
        runStatus={runStatus}
        selected={selected}
        theme="orange"
        onLabelChange={handleLabelChange}
      >
        <div className="flex items-center gap-1 rounded-md bg-surface-2 px-2 py-1 ring-1 ring-border">
          <input
            aria-label={t("nodes.codeFile.pathLabel")}
            className="nodrag nopan min-w-0 flex-1 bg-transparent font-mono text-[11px] font-semibold text-foreground focus:outline-none"
            name={`${id}-filePath`}
            placeholder="src/file.tsx"
            value={data.filePath}
            onChange={handleFilePathInputChange}
            onClick={handleStopPropagation}
            onKeyDown={handleStopPropagation}
            onMouseDown={handleStopPropagation}
          />
          <button
            className="nodrag nopan shrink-0 rounded p-0.5 text-orange-500 transition-colors hover:bg-orange-500/10 hover:text-orange-700 dark:hover:text-orange-300"
            title={t("nodes.codeFile.browseFile")}
            type="button"
            onClick={handleBrowseButtonClick}
            onMouseDown={handleStopPropagation}
          >
            <FolderOpen className="h-3.5 w-3.5" />
          </button>
          <input
            aria-label={t("nodes.codeFile.languageLabel")}
            className="nodrag nopan w-12 shrink-0 rounded bg-orange-500/10 px-1 py-0.5 text-right font-mono text-[10px] font-medium text-orange-700 focus:outline-none focus:bg-orange-500/15 dark:text-orange-300"
            name={`${id}-language`}
            placeholder="ts"
            value={data.language ?? ""}
            onChange={handleFileLanguageInputChange}
            onClick={handleStopPropagation}
            onKeyDown={handleStopPropagation}
            onMouseDown={handleStopPropagation}
          />
        </div>
        <textarea
          aria-label={t("nodes.codeFile.descriptionLabel")}
          className="nodrag nopan w-full resize-none rounded bg-transparent px-1 text-[11px] text-muted-foreground focus:bg-surface-2 focus:outline-none focus:ring-1 focus:ring-border-strong"
          name={`${id}-description`}
          placeholder={t("nodes.codeFile.descriptionPlaceholder")}
          rows={2}
          value={data.description ?? ""}
          onChange={handleFileDescriptionInputChange}
          onMouseDown={handleStopPropagation}
        />
      </NodeCard>

      <FolderBrowserDialog
        mode="file"
        open={browserOpen}
        onOpenChange={handleBrowserOpenChange}
        onSelect={handleFileSelect}
      />
    </div>
  );
};
