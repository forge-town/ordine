import { memo, useLayoutEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { Copy, Settings2, Sparkles, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { NodeRunStatus } from "@repo/schemas";
import { cn } from "@repo/ui/lib/utils";
import { NodeCardFrame, type NodeCardFrameProps } from "./NodeCardFrame";
import { NodeCardPorts } from "./NodeCardPorts";

export interface NodeCardProps extends NodeCardFrameProps {
  actions?: {
    onAsk?: (event: ReactMouseEvent<HTMLButtonElement>) => void;
    onConfigure?: (event: ReactMouseEvent<HTMLButtonElement>) => void;
    onDelete?: (event: ReactMouseEvent<HTMLButtonElement>) => void;
    onDuplicate?: (event: ReactMouseEvent<HTMLButtonElement>) => void;
  };
  leftActivePortCount?: number;
  leftActivePortMask?: number;
  leftConnectedPortCount?: number;
  leftConnectedPortMask?: number;
  leftHandle?: boolean;
  rightHandle?: boolean;
  rightActivePortCount?: number;
  rightActivePortMask?: number;
  rightConnectedPortCount?: number;
  rightConnectedPortMask?: number;
  leftHandleCount?: number;
  rightHandleCount?: number;
  compact?: boolean;
}

const useCardMaxPortSpread = (
  wrapperRef: React.RefObject<HTMLDivElement | null>,
  enabled: boolean,
) => {
  const [cardMaxPortSpread, setCardMaxPortSpread] = useState<number | undefined>(undefined);

  useLayoutEffect(() => {
    if (!enabled) {
      setCardMaxPortSpread(undefined);

      return;
    }

    const card = wrapperRef.current?.querySelector<HTMLElement>('[data-slot="card"]');
    if (!card) {
      return;
    }

    const updateCardMaxPortSpread = () => {
      const height = card.offsetHeight;
      const nextMaxSpread =
        Number.isFinite(height) && height > 0 ? Math.floor(height / 2) : undefined;
      setCardMaxPortSpread((currentMaxSpread) =>
        currentMaxSpread === nextMaxSpread ? currentMaxSpread : nextMaxSpread,
      );
    };

    updateCardMaxPortSpread();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(updateCardMaxPortSpread);
    observer.observe(card);

    return () => observer.disconnect();
  }, [enabled, wrapperRef]);

  return cardMaxPortSpread;
};

const statusDot: Record<NodeRunStatus, { className: string; pulse?: boolean }> = {
  cancelled: { className: "bg-muted-foreground/45" },
  done: { className: "bg-success" },
  failed: { className: "bg-destructive" },
  idle: { className: "bg-transparent ring-1 ring-muted-foreground/55" },
  queued: { className: "bg-muted-foreground/45", pulse: true },
  retrying: { className: "bg-warning", pulse: true },
  running: { className: "bg-foreground", pulse: true },
  skipped: { className: "bg-muted-foreground/45" },
  waitingForUser: { className: "bg-warning", pulse: true },
};

export const NodeCard = memo(
  ({
    leftActivePortCount,
    leftActivePortMask,
    leftConnectedPortCount,
    leftConnectedPortMask,
    leftHandle,
    rightHandle,
    rightActivePortCount,
    rightActivePortMask,
    rightConnectedPortCount,
    rightConnectedPortMask,
    leftHandleCount = 1,
    rightHandleCount = 1,
    compact = false,
    selected,
    theme,
    icon,
    label,
    detail,
    headerRight,
    children,
    bodyClassName,
    description,
    onLabelChange: handleLabelChange,
    runStatus,
    dimmed,
    actions,
  }: NodeCardProps) => {
    const { t } = useTranslation();
    const normalizedStatus = runStatus ?? "idle";
    const statusConfig = statusDot[normalizedStatus];
    const statusLabel = t(`workspace.canvas.nodes.status.${normalizedStatus}`, {
      defaultValue: normalizedStatus,
    });
    const {
      onAsk: handleAsk,
      onConfigure: handleConfigure,
      onDelete: handleDelete,
      onDuplicate: handleDuplicate,
    } = actions ?? {};
    const hasPorts = Boolean(leftHandle || rightHandle);
    const hasActions = Boolean(handleAsk || handleConfigure || handleDelete || handleDuplicate);
    const wrapperRef = useRef<HTMLDivElement | null>(null);
    const cardMaxPortSpread = useCardMaxPortSpread(wrapperRef, hasPorts);

    return (
      <div
        ref={wrapperRef}
        className="canvas-node-pop group/node-card relative w-[214px]"
        data-card-mode={compact ? "compact" : "expanded"}
        data-selected={selected ? "true" : "false"}
        data-theme={theme}
        data-testid="canvas-v2-node-shell-root"
      >
        <span
          aria-label={statusLabel}
          className="absolute right-2 top-2 z-10 inline-flex h-[9px] w-[9px]"
          title={statusLabel}
        >
          {statusConfig.pulse && (
            <span
              className={cn(
                "absolute h-full w-full animate-ping rounded-full",
                statusConfig.className,
              )}
            />
          )}
          <span
            className={cn(
              "relative inline-flex h-[9px] w-[9px] rounded-full shadow-[0_0_0_2px_var(--color-surface)]",
              statusConfig.className,
            )}
          />
        </span>
        {hasActions ? (
          <div
            className="absolute -top-3 right-1.5 z-20 hidden items-center gap-0.5 rounded-full bg-surface px-1 py-0.5 shadow-pill ring-1 ring-border group-hover/node-card:flex"
            data-testid="canvas-node-actions"
          >
            {handleConfigure ? (
              <button
                aria-label={t("workspace.canvas.nodes.actions.configure", {
                  defaultValue: "Configure node",
                })}
                className="rounded-full p-1 text-foreground/70 hover:bg-accent/70"
                data-testid="canvas-node-configure"
                title={t("workspace.canvas.nodes.actions.configure", {
                  defaultValue: "Configure node",
                })}
                type="button"
                onClick={handleConfigure}
              >
                <Settings2 className="h-3 w-3" />
              </button>
            ) : null}
            {handleAsk ? (
              <button
                aria-label={t("workspace.canvas.nodes.actions.ask", {
                  defaultValue: "Ask AI assistant",
                })}
                className="rounded-full p-1 text-foreground/70 hover:bg-accent/70"
                data-testid="canvas-node-ask"
                title={t("workspace.canvas.nodes.actions.ask", {
                  defaultValue: "Ask AI assistant",
                })}
                type="button"
                onClick={handleAsk}
              >
                <Sparkles className="h-3 w-3" />
              </button>
            ) : null}
            {handleDuplicate ? (
              <button
                aria-label={t("workspace.canvas.nodes.actions.duplicate", {
                  defaultValue: "Duplicate node",
                })}
                className="rounded-full p-1 text-foreground/70 hover:bg-accent/70"
                data-testid="canvas-node-duplicate"
                title={t("workspace.canvas.nodes.actions.duplicate", {
                  defaultValue: "Duplicate node",
                })}
                type="button"
                onClick={handleDuplicate}
              >
                <Copy className="h-3 w-3" />
              </button>
            ) : null}
            {handleDelete ? (
              <button
                aria-label={t("workspace.canvas.nodes.actions.delete", {
                  defaultValue: "Delete node",
                })}
                className="rounded-full p-1 text-foreground/70 hover:bg-destructive/10 hover:text-destructive"
                data-testid="canvas-node-delete"
                title={t("workspace.canvas.nodes.actions.delete", { defaultValue: "Delete node" })}
                type="button"
                onClick={handleDelete}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            ) : null}
          </div>
        ) : null}
        <NodeCardFrame
          bodyClassName={bodyClassName}
          description={description}
          detail={compact ? undefined : detail}
          dimmed={dimmed}
          headerRight={headerRight}
          icon={icon}
          label={label}
          compact={compact}
          runStatus={runStatus}
          selected={selected}
          theme={theme}
          onLabelChange={handleLabelChange}
        >
          {compact ? undefined : children}
        </NodeCardFrame>
        {hasPorts && (
          <NodeCardPorts
            cardMaxPortSpread={cardMaxPortSpread}
            leftActivePortCount={leftActivePortCount}
            leftActivePortMask={leftActivePortMask}
            leftConnectedPortCount={leftConnectedPortCount}
            leftConnectedPortMask={leftConnectedPortMask}
            leftHandle={leftHandle}
            leftHandleCount={leftHandleCount}
            rightActivePortCount={rightActivePortCount}
            rightActivePortMask={rightActivePortMask}
            rightConnectedPortCount={rightConnectedPortCount}
            rightConnectedPortMask={rightConnectedPortMask}
            rightHandle={rightHandle}
            rightHandleCount={rightHandleCount}
          />
        )}
      </div>
    );
  },
);
NodeCard.displayName = "NodeCard";
