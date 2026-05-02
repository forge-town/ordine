import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardAction,
} from "@repo/ui/card";
import { Handle, Position, useNodeId, useUpdateNodeInternals } from "@xyflow/react";
import { cn } from "@repo/ui/lib/utils";
import type { NodeRunStatus } from "@repo/pipeline-engine/schemas";
import { memo, useEffect, useLayoutEffect, useRef, useState } from "react";
import { getNodePortOffsets, makeNodePortId, type NodePortSide } from "./nodePorts";

export type NodeTheme = "emerald" | "violet" | "amber" | "sky" | "orange" | "teal" | "indigo";

const themeMap = {
  emerald: {
    ring: "ring-emerald-500/20",
    ringSelected: "ring-emerald-500",
    headerBg: "bg-emerald-50/50",
    iconBg: "bg-emerald-100",
    iconColor: "text-emerald-600",
    handleColor: "before:!bg-emerald-500",
  },
  violet: {
    ring: "ring-violet-500/20",
    ringSelected: "ring-violet-500",
    headerBg: "bg-violet-50/50",
    iconBg: "bg-violet-100",
    iconColor: "text-violet-600",
    handleColor: "before:!bg-violet-500",
  },
  amber: {
    ring: "ring-amber-500/20",
    ringSelected: "ring-amber-500",
    headerBg: "bg-amber-50/50",
    iconBg: "bg-amber-100",
    iconColor: "text-amber-600",
    handleColor: "before:!bg-amber-500",
  },
  sky: {
    ring: "ring-sky-500/20",
    ringSelected: "ring-sky-500",
    headerBg: "bg-sky-50/50",
    iconBg: "bg-sky-100",
    iconColor: "text-sky-600",
    handleColor: "before:!bg-sky-500",
  },
  orange: {
    ring: "ring-orange-500/20",
    ringSelected: "ring-orange-500",
    headerBg: "bg-orange-50/50",
    iconBg: "bg-orange-100",
    iconColor: "text-orange-600",
    handleColor: "before:!bg-orange-500",
  },
  teal: {
    ring: "ring-teal-500/20",
    ringSelected: "ring-teal-500",
    headerBg: "bg-teal-50/50",
    iconBg: "bg-teal-100",
    iconColor: "text-teal-600",
    handleColor: "before:!bg-teal-500",
  },
  indigo: {
    ring: "ring-indigo-500/20",
    ringSelected: "ring-indigo-500",
    headerBg: "bg-indigo-50/50",
    iconBg: "bg-indigo-100",
    iconColor: "text-indigo-600",
    handleColor: "before:!bg-indigo-500",
  },
} satisfies Record<NodeTheme, object>;

export interface NodeCardProps {
  leftHandle?: boolean;
  rightHandle?: boolean;
  leftHandleCount?: number;
  rightHandleCount?: number;
  selected?: boolean;
  theme: NodeTheme;
  icon: React.ElementType;
  label: string;
  /** Right side of the header row (e.g. status indicator) */
  headerRight?: React.ReactNode;
  /** Card body content */
  children?: React.ReactNode;
  /** Additional className for the body wrapper */
  bodyClassName?: string;
  /** Description below the label inside header */
  description?: string;
  /** When provided, the label becomes an inline editable input */
  onLabelChange?: (value: string) => void;
  /** Run status for pipeline test mode */
  runStatus?: NodeRunStatus;
  /** Whether the node is disabled during a test run */
  dimmed?: boolean;
}

const handleMouseDown = (e: React.MouseEvent) => e.stopPropagation();

const nodePortClassName =
  "node-card-port absolute !top-[calc(50%+var(--node-port-offset))] !z-10 !h-5 !w-5 rounded-full !border-0 !bg-transparent !opacity-100 transition-opacity duration-150 ease-out before:content-[''] before:absolute before:left-1/2 before:top-1/2 before:h-2 before:w-2 before:-translate-x-1/2 before:-translate-y-1/2 before:rounded-full before:shadow-[0_0_0_3px_rgba(255,255,255,0.95),0_2px_7px_rgba(15,23,42,0.22)] before:transition-transform before:duration-200 hover:before:scale-125";

const getNodePortStyle = (offset: number) =>
  ({
    "--node-port-offset": `${offset}px`,
  }) as React.CSSProperties;

const getNodePortPosition = (side: NodePortSide) =>
  side === "left" ? Position.Left : Position.Right;

export const NodeCard = memo(
  ({
    leftHandle,
    rightHandle,
    leftHandleCount = 1,
    rightHandleCount = 1,
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
  }: NodeCardProps) => {
    const t = themeMap[theme] ?? themeMap.emerald;
    const nodeId = useNodeId();
    const updateNodeInternals = useUpdateNodeInternals();
    const wrapperRef = useRef<HTMLDivElement | null>(null);
    const [cardMaxPortSpread, setCardMaxPortSpread] = useState<number | undefined>(undefined);
    const [isLabelEditing, setIsLabelEditing] = useState(false);
    const handleChange = onLabelChange
      ? (e: React.ChangeEvent<HTMLInputElement>) => onLabelChange(e.target.value)
      : undefined;
    const handleLabelClick = () => setIsLabelEditing(true);
    const handleLabelBlur = () => setIsLabelEditing(false);
    const leftPortOffsets = getNodePortOffsets(leftHandleCount, cardMaxPortSpread);
    const rightPortOffsets = getNodePortOffsets(rightHandleCount, cardMaxPortSpread);

    useLayoutEffect(() => {
      const card = wrapperRef.current?.querySelector<HTMLElement>('[data-slot="card"]');
      if (!card) {
        return;
      }

      const updateCardMaxPortSpread = () => {
        const height = card.offsetHeight;
        const nextMaxSpread =
          Number.isFinite(height) && height > 0 ? Math.floor(height / 2) : undefined;
        setCardMaxPortSpread((currentMaxSpread) =>
          currentMaxSpread === nextMaxSpread ? currentMaxSpread : nextMaxSpread
        );
      };

      updateCardMaxPortSpread();

      if (typeof ResizeObserver === "undefined") {
        return;
      }

      const observer = new ResizeObserver(updateCardMaxPortSpread);
      observer.observe(card);

      return () => observer.disconnect();
    }, []);

    useEffect(() => {
      if (!nodeId) {
        return;
      }

      updateNodeInternals(nodeId);
    }, [
      cardMaxPortSpread,
      leftHandle,
      leftHandleCount,
      nodeId,
      rightHandle,
      rightHandleCount,
      updateNodeInternals,
    ]);

    return (
      <div ref={wrapperRef} className="relative">
        <Card
          className={cn(
            "w-72 shrink-0 gap-0 py-0 transition-all duration-200 data-[size=sm]:gap-0 data-[size=sm]:py-0",
            selected ? cn("ring-2 shadow-lg", t.ringSelected) : cn("ring-1 hover:ring-2", t.ring),
            runStatus === "running" &&
              "ring-2 ring-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.4)] animate-pulse",
            runStatus === "pass" && "ring-2 ring-green-500",
            runStatus === "fail" && "ring-2 ring-red-500",
            dimmed && "opacity-40 pointer-events-none"
          )}
          size="sm"
        >
          <CardHeader
            className={cn("flex min-h-14 items-center rounded-none px-3 py-2", t.headerBg)}
          >
            <div className="flex w-full min-w-0 items-center gap-3">
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
                  t.iconBg
                )}
              >
                <Icon className={cn("h-4 w-4", t.iconColor)} />
              </div>
              <div className="flex min-h-8 flex-1 min-w-0 flex-col justify-center">
                {handleChange ? (
                  <input
                    aria-label="Node label"
                    className={cn(
                      "nodrag nopan w-auto max-w-full bg-transparent text-xs font-semibold leading-tight [field-sizing:content] focus:outline-none",
                      isLabelEditing ? "select-text" : "cursor-default select-none"
                    )}
                    name="nodeLabel"
                    readOnly={!isLabelEditing}
                    value={label}
                    onBlur={handleLabelBlur}
                    onChange={handleChange}
                    onClick={handleLabelClick}
                    onMouseDown={handleMouseDown}
                  />
                ) : (
                  <CardTitle className="truncate text-xs font-semibold leading-tight">
                    {label}
                  </CardTitle>
                )}
                {description && (
                  <CardDescription className="truncate text-[10px] leading-tight">
                    {description}
                  </CardDescription>
                )}
              </div>
              {headerRight && (
                <CardAction className="shrink-0 self-center">{headerRight}</CardAction>
              )}
            </div>
          </CardHeader>
          {children && (
            <CardContent className={cn("px-3 py-3", bodyClassName)}>{children}</CardContent>
          )}
        </Card>
        {leftHandle &&
          leftPortOffsets.map((offset, index) => (
            <Handle
              key={makeNodePortId("left", index)}
              className={cn(nodePortClassName, "!left-2.5 before:!left-0", t.handleColor)}
              id={makeNodePortId("left", index)}
              position={getNodePortPosition("left")}
              style={getNodePortStyle(offset)}
              type="target"
            />
          ))}
        {rightHandle &&
          rightPortOffsets.map((offset, index) => (
            <Handle
              key={makeNodePortId("right", index)}
              className={cn(nodePortClassName, "!right-2.5 before:!left-full", t.handleColor)}
              id={makeNodePortId("right", index)}
              position={getNodePortPosition("right")}
              style={getNodePortStyle(offset)}
              type="source"
            />
          ))}
      </div>
    );
  }
);
NodeCard.displayName = "NodeCard";
