import { useState } from "react";
import { Link2, Lock, Globe, BookMarked, FolderOpen, FolderInput, X, Eye } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { useShallow } from "zustand/shallow";
import { useCanvasPageStore, selectNodeRunState, selectNodePortCounts } from "../_store";
import type { GithubProjectObjectNodeData } from "@repo/schemas";
import { NodeCard } from "../NodeCard";
import { FolderTreePreview } from "../FolderNode/FolderTreePreview";
import { SiGitHubIcon } from "../../../components/icons/SiGitHubIcon";
import { GitHubConnectDialog, type ConnectedRepoInfo } from "./GitHubConnectDialog";
import { PickProjectDialog, type PickedProject } from "./PickProjectDialog";
import { PickLocalFolderDialog, type LocalFolderInfo } from "./PickLocalFolderDialog";
import { Button } from "@repo/ui/button";
import { Textarea } from "@repo/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/select";

export interface GitHubProjectNodeProps {
  id: string;
  data: GithubProjectObjectNodeData;
  selected?: boolean;
}

const handleMouseDown = (e: React.MouseEvent) => e.stopPropagation();

export const GitHubProjectNode = ({ id, data, selected }: GitHubProjectNodeProps) => {
  const { t } = useTranslation();
  const store = useCanvasPageStore();
  const { runStatus, dimmed } = useStore(store, useShallow(selectNodeRunState(id)));
  const nodeCardMode = useStore(store, (s) => s.nodeCardMode);
  const [pickOpen, setPickOpen] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);
  const [localFolderOpen, setLocalFolderOpen] = useState(false);

  const updateNodeData = useStore(store, (s) => s.updateNodeData);
  const handleGitHubProjectPick = useStore(store, (s) => s.handleGitHubProjectPick);
  const handleGitHubProjectConnect = useStore(store, (s) => s.handleGitHubProjectConnect);
  const handleGitHubProjectLocalFolder = useStore(store, (s) => s.handleGitHubProjectLocalFolder);
  const handleNodeAddExcludedPath = useStore(store, (s) => s.handleNodeAddExcludedPath);
  const handleNodeRemoveExcludedPath = useStore(store, (s) => s.handleNodeRemoveExcludedPath);
  const {
    rightActivePortCount,
    rightActivePortMask,
    rightConnectedPortCount,
    rightConnectedPortMask,
    rightPortCount,
  } = useStore(store, useShallow(selectNodePortCounts(id)));

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
    <div className="group relative w-fit overflow-visible">
      <NodeCard
        rightHandle
        bodyClassName="space-y-2"
        compact={nodeCardMode === "compact"}
        description={t("canvas.nodeTypes.github-project.label")}
        dimmed={dimmed}
        icon={SiGitHubIcon}
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
        {/* Repo display / connect area */}
        {isConnected ? (
          isLocal ? (
            /* Local folder connected */
            <div
              className="flex cursor-pointer items-center gap-1.5 rounded-md bg-surface-2 px-2.5 py-1.5 ring-1 ring-border transition-colors hover:bg-orange-500/10 hover:ring-orange-500/25"
              title={t("canvas.clickToSwitchLocalFolder")}
              onClick={handleLocalFolderOpen}
              onMouseDown={handleMouseDown}
            >
              <FolderOpen className="h-3 w-3 shrink-0 text-orange-500" />
              <span className="min-w-0 flex-1 truncate font-mono text-[11px] font-semibold text-foreground">
                {data.localPath}
              </span>
            </div>
          ) : (
            /* GitHub repo connected */
            <div
              className="flex cursor-pointer items-center gap-1.5 rounded-md bg-surface-2 px-2.5 py-1.5 ring-1 ring-border transition-colors hover:bg-orange-500/10 hover:ring-orange-500/25"
              title={t("canvas.clickToSwitchRepo")}
              onClick={handlePickOpen}
              onMouseDown={handleMouseDown}
            >
              {data.isPrivate ? (
                <Lock className="h-3 w-3 shrink-0 text-orange-500" />
              ) : (
                <Globe className="h-3 w-3 shrink-0 text-muted-foreground" />
              )}
              <span className="min-w-0 flex-1 truncate font-mono text-[11px] font-semibold text-foreground">
                {data.owner}/{data.repo}
              </span>
              {data.branch && (
                <span className="shrink-0 rounded bg-orange-500/10 px-1 py-0.5 font-mono text-[10px] font-medium text-orange-700 dark:text-orange-300">
                  {data.branch}
                </span>
              )}
            </div>
          )
        ) : (
          <div className="space-y-1.5" onMouseDown={handleMouseDown}>
            <Button
              className="nodrag nopan flex h-auto w-full items-center justify-center gap-1.5 rounded-md border border-orange-500/25 bg-orange-500/10 py-1.5 text-[11px] font-medium text-orange-700 transition-colors hover:bg-orange-500/15 dark:text-orange-300"
              type="button"
              variant="ghost"
              onClick={handlePickOpen}
            >
              <BookMarked className="h-3.5 w-3.5" />
              {t("canvas.pickFromLibrary")}
            </Button>
            <Button
              className="nodrag nopan flex h-auto w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border bg-surface-2/60 py-1.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted"
              type="button"
              variant="ghost"
              onClick={handleConnectOpen}
            >
              <Link2 className="h-3 w-3" />
              {t("canvas.enterUrlDirectly")}
            </Button>
            <Button
              className="nodrag nopan flex h-auto w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border bg-surface-2/60 py-1.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted"
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
            className="nodrag nopan min-h-0 w-full resize-none rounded border-none bg-transparent p-0 px-1 text-[11px] text-muted-foreground shadow-none focus:bg-surface-2 focus:outline-none focus:ring-1 focus:ring-border-strong"
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
            className="nodrag nopan flex items-center gap-1 text-[10px] text-muted-foreground transition-colors hover:text-orange-500"
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
              <Eye className="h-3 w-3 shrink-0 text-muted-foreground" />
              <Select value={disclosureMode} onValueChange={handleDisclosureModeChange}>
                <SelectTrigger className="nodrag nopan h-6 min-w-0 flex-1 border-border bg-surface-2 text-[10px] shadow-none focus:ring-1 focus:ring-ring">
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
                    className="inline-flex items-center gap-0.5 rounded-md bg-red-500/10 px-1.5 py-0.5 text-[10px] font-medium text-red-700 ring-1 ring-red-500/20 dark:text-red-300"
                  >
                    {ep}
                    <Button
                      aria-label={`${t("canvas.removeExclude")} ${ep}`}
                      className="nodrag nopan h-auto rounded-sm p-0 transition-colors hover:bg-red-500/15"
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
