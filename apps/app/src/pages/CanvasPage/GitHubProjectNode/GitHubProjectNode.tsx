import { useState } from "react";
import { Handle, Position } from "@xyflow/react";
import { Link2, Lock, Globe, BookMarked, FolderOpen, FolderInput, X, Eye } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { useShallow } from "zustand/shallow";
import { useHarnessCanvasStore, selectNodeRunState, type GitHubProjectNodeData } from "../_store";
import { NodeCard } from "../NodeCard";
import { FolderTreePreview } from "../FolderNode/FolderTreePreview";
import { SiGitHubIcon } from "@/components/icons/SiGitHubIcon";
import { GitHubConnectDialog, type ConnectedRepoInfo } from "./GitHubConnectDialog";
import { PickProjectDialog, type PickedProject } from "./PickProjectDialog";
import { PickLocalFolderDialog, type LocalFolderInfo } from "./PickLocalFolderDialog";
import { Button } from "@repo/ui/button";
import { Textarea } from "@repo/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/select";

export interface GitHubProjectNodeProps {
  id: string;
  data: GitHubProjectNodeData;
  selected?: boolean;
}

const handleMouseDown = (e: React.MouseEvent) => e.stopPropagation();

export const GitHubProjectNode = ({ id, data, selected }: GitHubProjectNodeProps) => {
  const { t } = useTranslation();
  const store = useHarnessCanvasStore();
  const { runStatus, dimmed } = useStore(store, useShallow(selectNodeRunState(id)));
  const [pickOpen, setPickOpen] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);
  const [localFolderOpen, setLocalFolderOpen] = useState(false);

  const updateNodeData = useStore(store, (s) => s.updateNodeData);
  const handleGitHubProjectPick = useStore(store, (s) => s.handleGitHubProjectPick);
  const handleGitHubProjectConnect = useStore(store, (s) => s.handleGitHubProjectConnect);
  const handleGitHubProjectLocalFolder = useStore(store, (s) => s.handleGitHubProjectLocalFolder);
  const handleNodeAddExcludedPath = useStore(store, (s) => s.handleNodeAddExcludedPath);
  const handleNodeRemoveExcludedPath = useStore(store, (s) => s.handleNodeRemoveExcludedPath);

  const isLocal = data.sourceType === "local";
  const isConnected = isLocal ? !!data.localPath : !!(data.owner && data.repo);
  const disclosureMode = data.disclosureMode ?? "tree";
  const excludedPaths: string[] = Array.isArray(data.excludedPaths) ? data.excludedPaths : [];
  const previewPath = isLocal ? (data.localPath ?? "") : "";

  const handlePick = (picked: PickedProject) => handleGitHubProjectPick(id, picked);

  const handleConnect = (info: ConnectedRepoInfo) => handleGitHubProjectConnect(id, info);

  const handleLocalFolder = (info: LocalFolderInfo) => handleGitHubProjectLocalFolder(id, info);

  const repoUrl =
    isConnected && !isLocal ? `https://github.com/${data.owner}/${data.repo}` : undefined;

  const handleLabelChange = (v: string) => updateNodeData(id, { label: v });
  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) =>
    updateNodeData(id, { description: e.target.value });
  const handlePickOpen = () => setPickOpen(true);
  const handleConnectOpen = () => setConnectOpen(true);
  const handleLocalFolderOpen = () => setLocalFolderOpen(true);
  const handlePickClose = () => setPickOpen(false);
  const handleConnectClose = () => setConnectOpen(false);
  const handleLocalFolderClose = () => setLocalFolderOpen(false);

  const handleDisclosureModeChange = (value: string | null) => {
    if (value)
      updateNodeData(id, {
        disclosureMode: value as "tree" | "full" | "files-only",
      });
  };
  const handleRemoveExcluded = (path: string) => handleNodeRemoveExcludedPath(id, path);
  const handleAddExcluded = (path: string) => handleNodeAddExcludedPath(id, path);

  return (
    <div className="group relative" style={{ overflow: "visible" }}>
      <NodeCard
        bodyClassName="space-y-2"
        description="GitHub Project"
        dimmed={dimmed}
        icon={SiGitHubIcon}
        label={data.label}
        runStatus={runStatus}
        selected={selected}
        theme="orange"
        onLabelChange={handleLabelChange}
      >
        {/* Repo display / connect area */}
        {isConnected ? (
          isLocal ? (
            /* Local folder connected */
            <div
              className="flex items-center gap-1.5 rounded-md border border-slate-100 bg-slate-50 px-2.5 py-1.5 cursor-pointer hover:bg-orange-50 hover:border-orange-200 transition-colors"
              title={t("canvas.clickToSwitchLocalFolder")}
              onClick={handleLocalFolderOpen}
              onMouseDown={handleMouseDown}
            >
              <FolderOpen className="h-3 w-3 shrink-0 text-orange-400" />
              <span className="font-mono text-[11px] font-semibold text-slate-700 flex-1 min-w-0 truncate">
                {data.localPath}
              </span>
            </div>
          ) : (
            /* GitHub repo connected */
            <div
              className="flex items-center gap-1.5 rounded-md border border-slate-100 bg-slate-50 px-2.5 py-1.5 cursor-pointer hover:bg-orange-50 hover:border-orange-200 transition-colors"
              title={t("canvas.clickToSwitchRepo")}
              onClick={handlePickOpen}
              onMouseDown={handleMouseDown}
            >
              {data.isPrivate ? (
                <Lock className="h-3 w-3 shrink-0 text-orange-400" />
              ) : (
                <Globe className="h-3 w-3 shrink-0 text-slate-400" />
              )}
              <span className="font-mono text-[11px] font-semibold text-slate-700 flex-1 min-w-0 truncate">
                {data.owner}/{data.repo}
              </span>
              {data.branch && (
                <span className="shrink-0 rounded bg-orange-100 px-1 py-0.5 font-mono text-[10px] font-medium text-orange-700">
                  {data.branch}
                </span>
              )}
            </div>
          )
        ) : (
          <div className="space-y-1.5" onMouseDown={handleMouseDown}>
            <Button
              className="nodrag nopan flex w-full items-center justify-center gap-1.5 rounded-md border border-orange-200 bg-orange-50 py-1.5 text-[11px] font-medium text-orange-700 hover:bg-orange-100 transition-colors h-auto"
              type="button"
              variant="ghost"
              onClick={handlePickOpen}
            >
              <BookMarked className="h-3.5 w-3.5" />
              {t("canvas.pickFromLibrary")}
            </Button>
            <Button
              className="nodrag nopan flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-slate-200 bg-slate-50/50 py-1.5 text-[11px] text-slate-500 hover:bg-slate-100 transition-colors h-auto"
              type="button"
              variant="ghost"
              onClick={handleConnectOpen}
            >
              <Link2 className="h-3 w-3" />
              {t("canvas.enterUrlDirectly")}
            </Button>
            <Button
              className="nodrag nopan flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-slate-200 bg-slate-50/50 py-1.5 text-[11px] text-slate-500 hover:bg-slate-100 transition-colors h-auto"
              type="button"
              variant="ghost"
              onClick={handleLocalFolderOpen}
            >
              <FolderInput className="h-3 w-3" />
              {t("canvas.selectLocalFolder")}
            </Button>
          </div>
        )}

        {/* Description */}
        {isConnected && !isLocal && (
          <Textarea
            className="nodrag nopan text-[11px] text-slate-500 bg-transparent w-full resize-none focus:outline-none focus:bg-slate-50 focus:ring-1 focus:ring-slate-200 rounded px-1 border-none shadow-none min-h-0 p-0"
            placeholder={t("canvas.repoDescPlaceholder")}
            rows={2}
            value={data.description ?? ""}
            onChange={handleDescriptionChange}
            onMouseDown={handleMouseDown}
          />
        )}

        {/* Connected repo link */}
        {repoUrl && (
          <a
            className="nodrag nopan flex items-center gap-1 text-[10px] text-slate-400 hover:text-orange-500 transition-colors"
            href={repoUrl}
            rel="noopener noreferrer"
            target="_blank"
            onMouseDown={handleMouseDown}
          >
            <Globe className="h-2.5 w-2.5" />
            {t("canvas.viewOnGitHub")}
          </a>
        )}

        {/* Disclosure mode & excluded paths */}
        {isConnected && (
          <>
            <div className="flex items-center gap-1.5" onMouseDown={handleMouseDown}>
              <Eye className="h-3 w-3 shrink-0 text-slate-400" />
              <Select value={disclosureMode} onValueChange={handleDisclosureModeChange}>
                <SelectTrigger className="nodrag nopan h-6 flex-1 min-w-0 border-slate-200 bg-slate-50 text-[10px] shadow-none focus:ring-1 focus:ring-slate-300">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tree">{t("canvas.disclosureTree")}</SelectItem>
                  <SelectItem value="files-only">{t("canvas.disclosureFilesOnly")}</SelectItem>
                  <SelectItem value="full">{t("canvas.disclosureFull")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {excludedPaths.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {excludedPaths.map((ep) => (
                  <span
                    key={ep}
                    className="inline-flex items-center gap-0.5 rounded-md bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-700 ring-1 ring-red-200"
                  >
                    {ep}
                    <Button
                      aria-label={`${t("canvas.removeExclude")} ${ep}`}
                      className="nodrag nopan rounded-sm p-0 hover:bg-red-200 transition-colors h-auto"
                      size="icon-xs"
                      type="button"
                      variant="ghost"
                      onClick={() => handleRemoveExcluded(ep)}
                      onMouseDown={handleMouseDown}
                    >
                      <X className="h-2.5 w-2.5" />
                    </Button>
                  </span>
                ))}
              </div>
            )}

            {previewPath && (
              <FolderTreePreview
                excludedPaths={excludedPaths}
                folderPath={previewPath}
                onExclude={handleAddExcluded}
              />
            )}
          </>
        )}
      </NodeCard>

      {/* Object nodes only emit connections — no target handle */}
      <Handle
        className="absolute h-3.5 w-3.5 rounded-full bg-orange-600 border-[3px] border-white shadow-sm transition-all hover:scale-110 -right-1.5 top-1/2 -mt-1.5"
        position={Position.Right}
        type="source"
      />

      <PickProjectDialog open={pickOpen} onClose={handlePickClose} onPick={handlePick} />

      <GitHubConnectDialog
        initialUrl={
          isConnected && !isLocal
            ? `https://github.com/${data.owner}/${data.repo}${data.branch ? `/tree/${data.branch}` : ""}`
            : ""
        }
        open={connectOpen}
        onClose={handleConnectClose}
        onConnect={handleConnect}
      />

      <PickLocalFolderDialog
        initialPath={isLocal ? (data.localPath ?? "") : ""}
        open={localFolderOpen}
        onClose={handleLocalFolderClose}
        onPick={handleLocalFolder}
      />
    </div>
  );
};
