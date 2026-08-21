import { cn } from "@repo/ui/lib/utils";
import type { NodeRunStatus } from "@repo/schemas";
import { memo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { NodeTheme } from "./nodeCardTheme";

export interface NodeCardFrameProps {
  selected?: boolean;
  theme: NodeTheme;
  icon: React.ElementType;
  label: string;
  detail?: string;
  compact?: boolean;
  headerRight?: React.ReactNode;
  children?: React.ReactNode;
  bodyClassName?: string;
  description?: string;
  onLabelChange?: (value: string) => void;
  runStatus?: NodeRunStatus;
  dimmed?: boolean;
}

const handleMouseDown = (e: React.MouseEvent) => e.stopPropagation();

export const NodeCardFrame = memo(
  ({
    selected,
    icon: Icon,
    label,
    detail,
    compact = false,
    headerRight,
    children,
    bodyClassName,
    description,
    onLabelChange,
    runStatus,
    dimmed,
  }: NodeCardFrameProps) => {
    const { t: translate } = useTranslation();
    const normalizedStatus = runStatus ?? "idle";
    const statusLabel = translate(`workspace.canvas.nodes.status.${normalizedStatus}`, {
      defaultValue: normalizedStatus,
    });
    const [isLabelEditing, setIsLabelEditing] = useState(false);
    const handleChange = onLabelChange
      ? (e: React.ChangeEvent<HTMLInputElement>) => onLabelChange(e.target.value)
      : undefined;
    const handleLabelClick = () => setIsLabelEditing(true);
    const handleLabelFocus = () => setIsLabelEditing(true);
    const handleLabelBlur = () => setIsLabelEditing(false);

    const hasBody =
      !compact &&
      Boolean(
        detail || children || normalizedStatus === "running" || normalizedStatus === "retrying",
      );

    return (
      <div
        data-slot="card"
        className={cn(
          "relative overflow-hidden rounded-xl bg-surface shadow-soft ring-1 ring-border transition-all duration-150",
          selected && "shadow-float ring-2 ring-foreground/40",
          !selected && "hover:shadow-float hover:ring-border-strong",
          dimmed && "opacity-45",
        )}
        data-testid="canvas-v2-node-card"
      >
        <div
          className="flex items-center gap-2 border-b border-border/70 px-2.5 py-2"
          data-slot="card-header"
        >
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-surface-2">
            <Icon className="h-3.5 w-3.5 text-foreground/80" />
          </div>
          <div className="min-w-0 flex-1">
            {handleChange ? (
              <span className="relative inline-block max-w-full min-w-0 overflow-hidden align-top">
                <span
                  aria-hidden="true"
                  className="invisible block max-w-full truncate whitespace-pre text-[12px] font-semibold leading-tight"
                >
                  {label || " "}
                </span>
                <input
                  aria-label={translate("canvas.nodeLabel")}
                  className={cn(
                    "nodrag nopan absolute inset-0 h-full w-full min-w-0 max-w-full truncate border-0 bg-transparent p-0 text-[12px] font-semibold leading-tight focus:outline-none",
                    isLabelEditing ? "select-text" : "cursor-inherit select-none",
                  )}
                  name="nodeLabel"
                  readOnly={!isLabelEditing}
                  value={label}
                  onBlur={handleLabelBlur}
                  onChange={handleChange}
                  onClick={handleLabelClick}
                  onFocus={handleLabelFocus}
                  onMouseDown={handleMouseDown}
                />
              </span>
            ) : (
              <div
                className="truncate text-[12px] font-semibold leading-tight"
                data-slot="card-title"
              >
                {label}
              </div>
            )}
            {description && (
              <div
                className="truncate text-[10px] text-muted-foreground"
                data-slot="card-description"
              >
                {description}
              </div>
            )}
          </div>
          {headerRight && (
            <div className="shrink-0" data-slot="card-action">
              {headerRight}
            </div>
          )}
        </div>
        {hasBody && (
          <div className={cn("space-y-1.5 px-2.5 py-2", bodyClassName)} data-slot="card-content">
            {detail ? (
              <div className="flex min-w-0 items-center gap-1.5 text-[10.5px] text-muted-foreground">
                <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/55" />
                <span className="truncate">{detail}</span>
              </div>
            ) : null}
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
        )}
      </div>
    );
  },
);
NodeCardFrame.displayName = "NodeCardFrame";
