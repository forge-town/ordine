import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardAction,
} from "@repo/ui/card";
import { cn } from "@repo/ui/lib/utils";

export type NodeTheme = "emerald" | "violet" | "amber" | "sky";

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
}

export const NodeCard = ({
  selected,
  theme,
  icon: Icon,
  label,
  headerRight,
  children,
  bodyClassName,
  description,
}: NodeCardProps) => {
  const t = themeMap[theme] ?? themeMap.emerald;

  return (
    <Card
      size="sm"
      className={cn(
        "transition-all duration-200",
        selected
          ? cn("ring-2 shadow-lg", t.ringSelected)
          : cn("ring-1 hover:ring-2", t.ring),
      )}
    >
      <CardHeader className={cn("pb-2", t.headerBg)}>
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
              t.iconBg,
            )}
          >
            <Icon className={cn("h-4 w-4", t.iconColor)} />
          </div>
          <div className="flex flex-col flex-1 min-w-0">
            <CardTitle className="text-xs font-semibold truncate">
              {label}
            </CardTitle>
            {description && (
              <CardDescription className="text-[10px] truncate">
                {description}
              </CardDescription>
            )}
          </div>
          {headerRight && <CardAction>{headerRight}</CardAction>}
        </div>
      </CardHeader>
      {children && (
        <CardContent className={cn("pt-0", bodyClassName)}>
          {children}
        </CardContent>
      )}
    </Card>
  );
};
