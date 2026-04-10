import { useState } from "react";
import { Handle, Position } from "@xyflow/react";
import { Link2, Lock, Globe, BookMarked, FolderOpen, FolderInput } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { useHarnessCanvasStore, type GitHubProjectNodeData } from "../_store";
import { NodeCard } from "../NodeCard";
import { useNodeRunState } from "../useNodeRunState";
import { SiGitHubIcon } from "./SiGitHubIcon";
import { GitHubConnectDialog, type ConnectedRepoInfo } from "./GitHubConnectDialog";
import { PickProjectDialog, type PickedProject } from "./PickProjectDialog";
import { PickLocalFolderDialog, type LocalFolderInfo } from "./PickLocalFolderDialog";
import { Button } from "@repo/ui/button";
import { Textarea } from "@repo/ui/textarea";

export interface GitHubProjectNodeProps {
  id: string;
  data: GitHubProjectNodeData;
  selected?: boolean;
}

const handleMouseDown = (e: React.MouseEvent) => e.stopPropagation();

export const GitHubProjectNode = ({ id, data, selected }: GitHubProjectNodeProps) => {
  const { t } = useTranslation();
  const { runStatus, dimmed } = useNodeRunState(id);
  const store = useHarnessCanvasStore();
  const [pickOpen, setPickOpen] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);
  const [localFolderOpen, setLocalFolderOpen] = useState(false);

  const updateNodeData = useStore(store, (s) => s.updateNodeData);

  const update = (patch: Record<string, unknown>) => updateNodeData(id, patch);

  const isLocal = data.sourceType === "local";
  const isConnected = isLocal ? !!data.localPath : !!(data.owner && data.repo);

  const handlePick = (picked: PickedProject) => {
    update({
      sourceType: "github",
      label: picked.label,
      owner: picked.owner,
      repo: picked.repo,
      branch: picked.branch,
      description: picked.description,
      isPrivate: picked.isPrivate,
      githubProjectId: picked.githubProjectId,
      localPath: undefined,
    });
  };

  const handleConnect = (info: ConnectedRepoInfo) => {
    update({
      sourceType: "github",
      label: info.label,
      owner: info.owner,
      repo: info.repo,
      branch: info.branch,
      description: info.description,
      githubProjectId: undefined,
      localPath: undefined,
    });
  };

  const handleLocalFolder = (info: LocalFolderInfo) => {
    update({
      sourceType: "local",
      label: info.label,
      localPath: info.localPath,
      owner: "",
      repo: "",
      branch: undefined,
      githubProjectId: undefined,
    });
  };

  const repoUrl =
    isConnected && !isLocal ? `https://github.com/${data.owner}/${data.repo}` : undefined;

  const handleLabelChange = (v: string) => update({ label: v });
  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) =>
    update({ description: e.target.value });
  const handlePickOpen = () => setPickOpen(true);
  const handleConnectOpen = () => setConnectOpen(true);
  const handleLocalFolderOpen = () => setLocalFolderOpen(true);
  const handlePickClose = () => setPickOpen(false);
  const handleConnectClose = () => setConnectOpen(false);
  const handleLocalFolderClose = () => setLocalFolderOpen(false);

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
