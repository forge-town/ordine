import {
  Ban,
  Circle,
  CircleCheck,
  Clock,
  Copy,
  LoaderCircle,
  MessageSquare,
  MessageSquarePlus,
  Settings2,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { useStore } from "zustand";
import { useShallow } from "zustand/shallow";
import { cn } from "@repo/ui/lib/utils";
import { normalizeNodeRunStatus, type NodeRunStatus } from "@repo/schemas";
import { selectNodePortCounts, selectNodeRunState, useCanvasPageStore } from "../_store";
import type { NodeTheme } from "../NodeCard/nodeCardTheme";
import { NodeCardPorts } from "../NodeCard/NodeCardPorts";
import { useNodeAnnotations } from "../annotations";

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

const statusDot: Record<
  NodeRunStatus,
  { className: string; label: string; pulse?: boolean; soft?: boolean }
> = {
  idle: { className: "bg-transparent ring-1 ring-muted-foreground/55", label: "Idle", soft: true },
  queued: { className: "bg-muted-foreground/45", label: "Queued", pulse: true, soft: true },
  running: { className: "bg-foreground", label: "Running", pulse: true },
  waitingForUser: { className: "bg-warning", label: "Awaiting review", pulse: true },
  retrying: { className: "bg-warning", label: "Retrying", pulse: true },
  done: { className: "bg-success", label: "Done" },
  failed: { className: "bg-destructive", label: "Failed" },
  skipped: { className: "bg-muted-foreground/45", label: "Skipped", soft: true },
  cancelled: { className: "bg-muted-foreground/45", label: "Cancelled", soft: true },
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

const statusMessage: Record<NodeRunStatus, string> = {
  idle: "Ready",
  queued: "Queued",
  running: "Working...",
  waitingForUser: "Checkpoint · review",
  retrying: "Retrying",
  done: "Completed",
  failed: "Needs attention",
  skipped: "Skipped",
  cancelled: "Cancelled",
};

const GNodeStatusDot = ({ status }: { status: NodeRunStatus }) => {
  const config = statusDot[status];

  return (
    <span
      aria-label={config.label}
      className="absolute right-2 top-2 z-10 inline-flex h-[9px] w-[9px]"
      title={config.label}
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
  const store = useCanvasPageStore();
  const phase = useStore(store, (state) => state.phase);
  const nodeCardMode = useStore(store, (state) => state.nodeCardMode);
  const { runStatus, dimmed } = useStore(store, useShallow(selectNodeRunState(id)));
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
  } = useStore(store, useShallow(selectNodePortCounts(id)));
  const duplicateNode = useStore(store, (state) => state.duplicateNode);
  const removeNode = useStore(store, (state) => state.removeNode);
  const setAnnotatingId = useStore(store, (state) => state.setAnnotatingId);
  const setViewingAnnId = useStore(store, (state) => state.setViewingAnnId);
  const setConfigNodeId = useStore(store, (state) => state.setConfigNodeId);
  const nodeAnnotations = useNodeAnnotations(id);
  const normalizedStatus = normalizeNodeRunStatus(runStatus ?? dataStatus ?? "idle");
  const visibleAnnotationCount = annotationCount ?? nodeAnnotations.length;
  const preview = phase === "proposal";
  const StatusIcon = statusIcon[normalizedStatus];
  const themeClass = themeClasses[theme] ?? themeClasses.indigo;
  const showBody = nodeCardMode !== "compact";

  const handleConfigClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setConfigNodeId(id);
  };
  const handleAnnotateClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setAnnotatingId(id);
  };
  const handleViewAnnotationsClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setViewingAnnId(id);
  };
  const handleDuplicateClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    duplicateNode(id);
  };
  const handleDeleteClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    removeNode(id);
  };

  return (
    <div
      className="canvas-node-pop group/node-card relative w-[214px]"
      data-card-mode={nodeCardMode}
      data-selected={selected ? "true" : "false"}
    >
      {visibleAnnotationCount > 0 && (
        <button
          aria-label="View annotations"
          className="absolute -left-2 -top-2 z-20 flex h-5 items-center gap-0.5 rounded-full bg-foreground px-1.5 text-[9.5px] font-semibold text-primary-foreground shadow-pill"
          type="button"
          onClick={handleViewAnnotationsClick}
        >
          <MessageSquare className="h-2.5 w-2.5" />
          {visibleAnnotationCount}
        </button>
      )}
      {!preview && <GNodeStatusDot status={normalizedStatus} />}
      <div
        className={cn(
          "relative overflow-hidden rounded-xl bg-surface shadow-soft ring-1 ring-border transition-all duration-150",
          selected && "shadow-float ring-2 ring-foreground/40",
          !selected && "hover:shadow-float hover:ring-border-strong",
          preview && "opacity-80 ring-dashed ring-border-strong",
          dimmed && "opacity-45",
        )}
        data-testid="gnode-shell"
      >
        <div className="absolute -top-3 right-1.5 z-20 hidden items-center gap-0.5 rounded-full bg-surface px-1 py-0.5 shadow-pill ring-1 ring-border group-hover/node-card:flex">
          <button
            aria-label="Configure node"
            className="rounded-full p-1 text-foreground/70 hover:bg-accent/70"
            title="Configure"
            type="button"
            onClick={handleConfigClick}
          >
            <Settings2 className="h-3 w-3" />
          </button>
          <button
            aria-label="Annotate node"
            className="rounded-full p-1 text-foreground/70 hover:bg-accent/70"
            title="Annotate"
            type="button"
            onClick={handleAnnotateClick}
          >
            <MessageSquarePlus className="h-3 w-3" />
          </button>
          <button
            aria-label="Duplicate node"
            className="rounded-full p-1 text-foreground/70 hover:bg-accent/70"
            title="Duplicate"
            type="button"
            onClick={handleDuplicateClick}
          >
            <Copy className="h-3 w-3" />
          </button>
          <button
            aria-label="Delete node"
            className="rounded-full p-1 text-foreground/70 hover:bg-destructive/10 hover:text-destructive"
            title="Delete"
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
              new
            </span>
          ) : null}
        </div>
        {showBody && (
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
              <span className="truncate">{detail ?? statusMessage[normalizedStatus]}</span>
            </div>
            {children}
          </div>
        )}
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
