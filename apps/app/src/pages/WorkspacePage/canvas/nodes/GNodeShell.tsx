import { Copy, MessageSquare, Settings2, Sparkles, Trash2, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/shallow";
import { cn } from "@repo/ui/lib/utils";
import { normalizeNodeRunStatus, type NodeRunStatus } from "@repo/schemas";
import { useWorkspaceStore } from "../../_store/workspaceStore";
import { selectNodePortCounts, selectNodeRunState } from "../_store/selectors";
import { useCanvasStore } from "../_store/canvasStore";
import type { ProposalPreviewDiff } from "../_store/proposalSlice";
import type { NodeTheme } from "./support/nodeCardTheme";
import { NodeCardPorts } from "./support/NodeCardPorts";

export type GNodeShellStatus = NodeRunStatus | "preview";

export interface GNodeShellProps {
  annotationCount?: number;
  children?: React.ReactNode;
  dataStatus?: string;
  detail?: string;
  icon: LucideIcon;
  id: string;
  kind: string;
  leftHandle?: boolean;
  rightHandle?: boolean;
  selected?: boolean;
  theme: NodeTheme;
  title: string;
}

const statusDot: Record<NodeRunStatus, { className: string; pulse?: boolean; soft?: boolean }> = {
  idle: { className: "bg-transparent ring-1 ring-muted-foreground/55", soft: true },
  queued: { className: "bg-muted-foreground/45", pulse: true, soft: true },
  running: { className: "bg-foreground", pulse: true },
  waitingForUser: { className: "bg-warning", pulse: true },
  retrying: { className: "bg-warning", pulse: true },
  done: { className: "bg-success" },
  failed: { className: "bg-destructive" },
  skipped: { className: "bg-muted-foreground/45", soft: true },
  cancelled: { className: "bg-muted-foreground/45", soft: true },
};

/** Prototype canvas.jsx preview badges: new (success) / edited (warning) / reused (muted). */
const previewBadgeClasses: Record<ProposalPreviewDiff, string> = {
  modified: "bg-warning/15 text-warning",
  new: "bg-success/15 text-success",
  reuse: "bg-muted-foreground/15 text-muted-foreground",
};

const getStatusKey = (status: NodeRunStatus) => `workspace.canvas.nodes.status.${status}`;

const GNodeStatusDot = ({ label, status }: { label: string; status: NodeRunStatus }) => {
  const config = statusDot[status];

  return (
    <span
      aria-label={label}
      className="absolute right-2 top-2 z-10 inline-flex h-[9px] w-[9px]"
      title={label}
    >
      {config.pulse && (
        <span
          className={cn("absolute h-full w-full animate-ping rounded-full", config.className)}
        />
      )}
      <span
        className={cn(
          "relative inline-flex h-[9px] w-[9px] rounded-full shadow-[0_0_0_2px_var(--color-surface)]",
          config.className,
        )}
      />
    </span>
  );
};

export const GNodeShell = ({
  annotationCount,
  children,
  dataStatus,
  detail,
  icon: Icon,
  id,
  kind,
  leftHandle,
  rightHandle,
  selected,
  theme,
  title,
}: GNodeShellProps) => {
  const { t } = useTranslation();
  const previewDiff = useCanvasStore((state) =>
    state.proposalPreview ? (state.proposalPreview.diffById[id] ?? "reuse") : null,
  );
  const { runStatus, dimmed } = useCanvasStore(useShallow(selectNodeRunState(id)));
  const {
    leftActivePortCount,
    leftActivePortMask,
    leftConnectedPortCount,
    leftConnectedPortMask,
    leftPortCount,
    rightActivePortCount,
    rightActivePortMask,
    rightConnectedPortCount,
    rightConnectedPortMask,
    rightPortCount,
  } = useCanvasStore(useShallow(selectNodePortCounts(id)));
  const drillStack = useCanvasStore((state) => state.drillStack);
  const hoverRefId = useWorkspaceStore((state) => state.hoverRefId);
  const duplicateNode = useCanvasStore((state) => state.duplicateNode);
  const deleteNode = useCanvasStore((state) => state.deleteNode);
  const setAskNodeId = useCanvasStore((state) => state.setAskNodeId);
  const setConfigNodeId = useCanvasStore((state) => state.setConfigNodeId);
  const normalizedStatus = normalizeNodeRunStatus(runStatus ?? dataStatus ?? "idle");
  const preview = previewDiff !== null;
  const statusLabel = t(getStatusKey(normalizedStatus));
  const refIdForNode = drillStack.length > 0 ? [...drillStack, id].join("/") : id;
  const hoverHighlight = hoverRefId === refIdForNode;
  const anchorCount = useWorkspaceStore((state) => state.anchorCounts[refIdForNode] ?? 0);
  const visibleAnnotationCount = annotationCount ?? anchorCount;
  const setThread = useWorkspaceStore((state) => state.setThread);
  const setAgentOpen = useWorkspaceStore((state) => state.setAgentOpen);

  const handleConfigClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setConfigNodeId(id);
  };
  const handleAskClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setAskNodeId(id);
  };
  const handleOpenThreadClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setThread({ id: refIdForNode, label: title });
    setAgentOpen(true);
  };
  const handleDuplicateClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    duplicateNode(id);
  };
  const handleDeleteClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    deleteNode(id);
  };

  return (
    <div
      className="canvas-node-pop group/node-card relative w-[214px]"
      data-card-mode="expanded"
      data-selected={selected ? "true" : "false"}
      data-theme={theme}
      data-testid="canvas-v2-node-shell-root"
    >
      {visibleAnnotationCount > 0 && (
        <button
          aria-label={t("workspace.canvas.nodes.actions.openThread")}
          className="absolute -left-2 -top-2 z-20 flex h-5 items-center gap-0.5 rounded-full bg-foreground px-1.5 text-[9.5px] font-semibold text-primary-foreground shadow-pill"
          data-testid="canvas-v2-node-thread-badge"
          title={t("workspace.canvas.nodes.actions.openThread")}
          type="button"
          onClick={handleOpenThreadClick}
        >
          <MessageSquare className="h-2.5 w-2.5" />
          {visibleAnnotationCount}
        </button>
      )}
      {!preview && <GNodeStatusDot label={statusLabel} status={normalizedStatus} />}
      {hoverHighlight ? (
        <span
          className="pointer-events-none absolute -inset-1 z-10 rounded-2xl ring-2 ring-foreground/60"
          data-testid="canvas-v2-node-hover-highlight"
        />
      ) : null}
      {/* Hover toolbar lives on the wrapper (NOT inside the overflow-hidden card) so the -top-3 pill is never clipped. */}
      <div className="absolute -top-3 right-1.5 z-20 hidden items-center gap-0.5 rounded-full bg-surface px-1 py-0.5 shadow-pill ring-1 ring-border group-hover/node-card:flex">
        <button
          aria-label={t("workspace.canvas.nodes.actions.configure")}
          className="rounded-full p-1 text-foreground/70 hover:bg-accent/70"
          data-testid="canvas-v2-node-configure"
          title={t("workspace.canvas.nodes.actions.configure")}
          type="button"
          onClick={handleConfigClick}
        >
          <Settings2 className="h-3 w-3" />
        </button>
        <button
          aria-label={t("workspace.canvas.nodes.actions.ask")}
          className="rounded-full p-1 text-foreground/70 hover:bg-accent/70"
          data-testid="canvas-v2-node-ask"
          title={t("workspace.canvas.nodes.actions.ask")}
          type="button"
          onClick={handleAskClick}
        >
          <Sparkles className="h-3 w-3" />
        </button>
        <button
          aria-label={t("workspace.canvas.nodes.actions.duplicate")}
          className="rounded-full p-1 text-foreground/70 hover:bg-accent/70"
          data-testid="canvas-v2-node-duplicate"
          title={t("workspace.canvas.nodes.actions.duplicate")}
          type="button"
          onClick={handleDuplicateClick}
        >
          <Copy className="h-3 w-3" />
        </button>
        <button
          aria-label={t("workspace.canvas.nodes.actions.delete")}
          className="rounded-full p-1 text-foreground/70 hover:bg-destructive/10 hover:text-destructive"
          data-testid="canvas-v2-node-delete"
          title={t("workspace.canvas.nodes.actions.delete")}
          type="button"
          onClick={handleDeleteClick}
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
      <div
        className={cn(
          "relative overflow-hidden rounded-xl bg-surface shadow-soft ring-1 ring-border transition-all duration-150",
          selected && "shadow-float ring-2 ring-foreground/40",
          !selected && "hover:shadow-float hover:ring-border-strong",
          preview && "opacity-80 ring-dashed ring-border-strong",
          dimmed && "opacity-45",
        )}
        data-testid="canvas-v2-node-card"
      >
        <div className="flex items-center gap-2 border-b border-border/70 px-2.5 py-2">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-surface-2">
            <Icon className="h-3.5 w-3.5 text-foreground/80" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12px] font-semibold leading-tight">{title}</div>
            <div className="truncate text-[10px] text-muted-foreground">{kind}</div>
          </div>
          {previewDiff !== null ? (
            <span
              className={cn(
                "shrink-0 rounded-full px-1.5 py-0.5 text-[9.5px] font-medium",
                previewBadgeClasses[previewDiff],
              )}
              data-testid="canvas-v2-node-preview-badge"
            >
              {t(`workspace.canvas.nodes.preview.${previewDiff}`)}
            </span>
          ) : null}
        </div>
        <div className="space-y-1.5 px-2.5 py-2">
          <div className="flex min-w-0 items-center gap-1.5 text-[10.5px] text-muted-foreground">
            <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/55" />
            <span className="truncate">{detail ?? statusLabel}</span>
          </div>
          {normalizedStatus === "running" || normalizedStatus === "retrying" ? (
            <div className="space-y-1 pt-0.5">
              <div className="h-1 overflow-hidden rounded-full bg-surface-2">
                <div
                  className={cn(
                    "h-1 w-full animate-pulse rounded-full",
                    normalizedStatus === "retrying" ? "bg-warning" : "bg-foreground",
                  )}
                />
              </div>
              <div className="truncate text-[10px] text-foreground/70">{statusLabel}</div>
            </div>
          ) : null}
          {children}
        </div>
      </div>
      {(leftHandle || rightHandle) && (
        <NodeCardPorts
          leftActivePortCount={leftActivePortCount}
          leftActivePortMask={leftActivePortMask}
          leftConnectedPortCount={leftConnectedPortCount}
          leftConnectedPortMask={leftConnectedPortMask}
          leftHandle={leftHandle}
          leftHandleCount={leftPortCount}
          rightActivePortCount={rightActivePortCount}
          rightActivePortMask={rightActivePortMask}
          rightConnectedPortCount={rightConnectedPortCount}
          rightConnectedPortMask={rightConnectedPortMask}
          rightHandle={rightHandle}
          rightHandleCount={rightPortCount}
        />
      )}
    </div>
  );
};
