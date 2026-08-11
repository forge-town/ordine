import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardAction,
} from "@repo/ui/card";
import { cn } from "@repo/ui/lib/utils";
import type { NodeRunStatus } from "@repo/schemas";
import { memo, useState } from "react";
import { useTranslation } from "react-i18next";
import { themeMap, type NodeTheme } from "./nodeCardTheme";

export interface NodeCardFrameProps {
  selected?: boolean;
  theme: NodeTheme;
  icon: React.ElementType;
  label: string;
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
    theme,
    icon: Icon,
    label,
    headerRight,
    children,
    bodyClassName,
    description,
    onLabelChange,
    runStatus,
    dimmed,
  }: NodeCardFrameProps) => {
    const { t: translate } = useTranslation();
    const t = themeMap[theme] ?? themeMap.emerald;
    const [isLabelEditing, setIsLabelEditing] = useState(false);
    const handleChange = onLabelChange
      ? (e: React.ChangeEvent<HTMLInputElement>) => onLabelChange(e.target.value)
      : undefined;
    const handleLabelClick = () => setIsLabelEditing(true);
    const handleLabelFocus = () => setIsLabelEditing(true);
    const handleLabelBlur = () => setIsLabelEditing(false);

    return (
      <Card
        className={cn(
          "w-[214px] shrink-0 gap-0 rounded-xl bg-surface py-0 shadow-soft transition-all duration-200 data-[size=sm]:gap-0 data-[size=sm]:py-0",
          selected
            ? "shadow-float ring-2 ring-foreground/40"
            : "ring-1 ring-border hover:shadow-float hover:ring-border-strong",
          runStatus === "running" &&
            "ring-2 ring-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.4)] animate-pulse",
          runStatus === "done" && "ring-2 ring-green-500",
          runStatus === "failed" && "ring-2 ring-red-500",
          dimmed && "opacity-40 pointer-events-none",
        )}
        size="sm"
      >
        <CardHeader className={cn("flex min-h-12 items-center px-2.5 py-2", t.headerBg)}>
          <div className="flex w-full min-w-0 items-center gap-2">
            <div
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-md",
                t.iconBg,
              )}
            >
              <Icon className={cn("size-3.5", t.iconColor)} />
            </div>
            <div className="flex min-h-6 min-w-0 flex-1 flex-col items-start justify-center overflow-hidden">
              {handleChange ? (
                <span className="relative inline-block max-w-full min-w-0 overflow-hidden align-top">
                  <span
                    aria-hidden="true"
                    className="invisible block max-w-full truncate whitespace-pre text-xs font-semibold leading-tight"
                  >
                    {label || " "}
                  </span>
                  <input
                    aria-label={translate("canvas.nodeLabel")}
                    className={cn(
                      "nodrag nopan absolute inset-0 h-full w-full min-w-0 max-w-full truncate border-0 bg-transparent p-0 text-xs font-semibold leading-tight focus:outline-none",
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
                <CardTitle className="w-full max-w-full truncate text-xs font-semibold leading-tight">
                  {label}
                </CardTitle>
              )}
              {description && (
                <CardDescription className="w-full max-w-full truncate text-[10px] leading-tight">
                  {description}
                </CardDescription>
              )}
            </div>
            {headerRight && (
              <CardAction className="ml-auto shrink-0 self-center">{headerRight}</CardAction>
            )}
          </div>
        </CardHeader>
        {children && (
          <CardContent className={cn("border-t border-border/70 px-2.5 py-2.5", bodyClassName)}>
            {children}
          </CardContent>
        )}
      </Card>
    );
  },
);
NodeCardFrame.displayName = "NodeCardFrame";
