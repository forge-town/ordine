import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardAction,
} from "@repo/ui/card";
import { cn } from "@repo/ui/lib/utils";
import type { NodeRunStatus } from "@repo/pipeline-engine/schemas";

export type NodeTheme = "emerald" | "violet" | "amber" | "sky" | "orange" | "teal" | "indigo";

const themeMap = {
  emerald: {
    ring: "ring-emerald-500/20",
    ringSelected: "ring-emerald-500",
    headerBg: "bg-emerald-50/50",
    iconBg: "bg-emerald-100",
    iconColor: "text-emerald-600",
  },
  violet: {
    ring: "ring-violet-500/20",
    ringSelected: "ring-violet-500",
    headerBg: "bg-violet-50/50",
    iconBg: "bg-violet-100",
    iconColor: "text-violet-600",
  },
  amber: {
    ring: "ring-amber-500/20",
    ringSelected: "ring-amber-500",
    headerBg: "bg-amber-50/50",
    iconBg: "bg-amber-100",
    iconColor: "text-amber-600",
  },
  sky: {
    ring: "ring-sky-500/20",
    ringSelected: "ring-sky-500",
    headerBg: "bg-sky-50/50",
    iconBg: "bg-sky-100",
    iconColor: "text-sky-600",
  },
  orange: {
    ring: "ring-orange-500/20",
    ringSelected: "ring-orange-500",
    headerBg: "bg-orange-50/50",
    iconBg: "bg-orange-100",
    iconColor: "text-orange-600",
  },
  teal: {
    ring: "ring-teal-500/20",
    ringSelected: "ring-teal-500",
    headerBg: "bg-teal-50/50",
    iconBg: "bg-teal-100",
    iconColor: "text-teal-600",
  },
  indigo: {
    ring: "ring-indigo-500/20",
    ringSelected: "ring-indigo-500",
    headerBg: "bg-indigo-50/50",
    iconBg: "bg-indigo-100",
    iconColor: "text-indigo-600",
  },
} satisfies Record<NodeTheme, object>;

export interface NodeCardProps {
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

export const NodeCard = ({
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
  const handleChange = onLabelChange
    ? (e: React.ChangeEvent<HTMLInputElement>) => onLabelChange(e.target.value)
    : undefined;

  return (
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
      <CardHeader className={cn("flex min-h-14 items-center rounded-none px-3 py-2", t.headerBg)}>
        <div className="flex w-full min-w-0 items-center gap-3">
          <div
            className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-md", t.iconBg)}
          >
            <Icon className={cn("h-4 w-4", t.iconColor)} />
          </div>
          <div className="flex min-h-8 flex-1 min-w-0 flex-col justify-center">
            {handleChange ? (
              <input
                aria-label="Node label"
                className="nodrag nopan w-full bg-transparent text-xs font-semibold leading-tight focus:outline-none"
                name="nodeLabel"
                value={label}
                onChange={handleChange}
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
          {headerRight && <CardAction className="shrink-0 self-center">{headerRight}</CardAction>}
        </div>
      </CardHeader>
      {children && <CardContent className={cn("px-3 py-3", bodyClassName)}>{children}</CardContent>}
    </Card>
  );
};
