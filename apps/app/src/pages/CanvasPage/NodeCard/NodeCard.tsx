import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardAction,
} from "@repo/ui/card";
import { cn } from "@repo/ui/lib/utils";
import type { NodeRunStatus } from "../nodeSchemas";

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
        "transition-all duration-200",
        selected ? cn("ring-2 shadow-lg", t.ringSelected) : cn("ring-1 hover:ring-2", t.ring),
        runStatus === "running" &&
          "ring-2 ring-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.4)] animate-pulse",
        runStatus === "pass" && "ring-2 ring-green-500",
        runStatus === "fail" && "ring-2 ring-red-500",
        dimmed && "opacity-40 pointer-events-none"
      )}
      size="sm"
    >
      <CardHeader className={cn("pb-2", t.headerBg)}>
        <div className="flex items-center gap-2">
          <div
            className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-md", t.iconBg)}
          >
            <Icon className={cn("h-4 w-4", t.iconColor)} />
          </div>
          <div className="flex flex-col flex-1 min-w-0">
            {handleChange ? (
              <input
                className="nodrag nopan bg-transparent text-xs font-semibold w-full focus:outline-none"
                value={label}
                onChange={handleChange}
                onMouseDown={handleMouseDown}
              />
            ) : (
              <CardTitle className="text-xs font-semibold truncate">{label}</CardTitle>
            )}
            {description && (
              <CardDescription className="text-[10px] truncate">{description}</CardDescription>
            )}
          </div>
          {headerRight && <CardAction>{headerRight}</CardAction>}
        </div>
      </CardHeader>
      {children && <CardContent className={cn("pt-0", bodyClassName)}>{children}</CardContent>}
    </Card>
  );
};
