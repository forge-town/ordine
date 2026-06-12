import {
  Ban,
  Circle,
  CircleCheck,
  Clock,
  Copy,
  LoaderCircle,
  MessageSquare,
  Settings2,
  Sparkles,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/shallow";
import { cn } from "@repo/ui/lib/utils";
import { normalizeNodeRunStatus, type NodeRunStatus } from "@repo/schemas";
import { useWorkspaceStore } from "../../_store/workspaceStore";
import { selectNodePortCounts, selectNodeRunState } from "../_store/selectors";
import { useCanvasStore } from "../_store/canvasStore";
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

const statusIcon: Record<NodeRunStatus, LucideIcon> = {
  idle: Circle,
  queued: Clock,
  running: LoaderCircle,
  waitingForUser: Clock,
  retrying: LoaderCircle,
  done: CircleCheck,
  failed: Ban,
  skipped: Circle,
  cancelled: Ban,
};

const themeClasses: Record<NodeTheme, { icon: string; ring: string }> = {
  amber: { icon: "bg-amber-100 text-amber-700", ring: "ring-amber-300/70" },
  emerald: { icon: "bg-emerald-100 text-emerald-700", ring: "ring-emerald-300/70" },
  orange: { icon: "bg-orange-100 text-orange-700", ring: "ring-orange-300/70" },
  sky: { icon: "bg-sky-100 text-sky-700", ring: "ring-sky-300/70" },
  indigo: { icon: "bg-indigo-100 text-indigo-700", ring: "ring-indigo-300/70" },
  teal: { icon: "bg-teal-100 text-teal-700", ring: "ring-teal-300/70" },
  violet: { icon: "bg-violet-100 text-violet-700", ring: "ring-violet-300/70" },
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
  const pendingProposal = useCanvasStore((state) => state.pendingProposal);
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
  const preview = Boolean(pendingProposal);
  const StatusIcon = statusIcon[normalizedStatus];
  const themeClass = themeClasses[theme] ?? themeClasses.indigo;
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
        <div className="flex items-center gap-2 border-b border-border/70 px-2.5 py-2">
          <div
            className={cn(
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-md",
              themeClass.icon,
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12px] font-semibold leading-tight">{title}</div>
            <div className="truncate text-[10px] text-muted-foreground">{kind}</div>
          </div>
          {preview ? (
            <span className="rounded-full bg-success/10 px-1.5 py-0.5 text-[9.5px] font-medium text-success">
              {t("workspace.canvas.nodes.previewBadge")}
            </span>
          ) : null}
        </div>
        <div className="space-y-1.5 px-2.5 py-2">
          <div className="flex min-w-0 items-center gap-1.5 text-[10.5px] text-muted-foreground">
            <StatusIcon
              className={cn(
                "h-3 w-3 shrink-0",
                normalizedStatus === "running" || normalizedStatus === "retrying"
                  ? "animate-spin"
                  : "",
              )}
            />
            <span className="truncate">{detail ?? statusLabel}</span>
          </div>
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
          theme={theme}
        />
      )}
    </div>
  );
};
