import { cn } from "@repo/ui/lib/utils";

export type NodeTheme = "emerald" | "violet" | "amber" | "sky";

const themeMap = {
  emerald: {
    topBorder: "border-t-emerald-500",
    iconBg: "bg-emerald-500",
    ringSelected: "ring-2 ring-emerald-400 ring-offset-1",
    shadowSelected: "shadow-emerald-100",
  },
  violet: {
    topBorder: "border-t-violet-500",
    iconBg: "bg-violet-500",
    ringSelected: "ring-2 ring-violet-400 ring-offset-1",
    shadowSelected: "shadow-violet-100",
  },
  amber: {
    topBorder: "border-t-amber-500",
    iconBg: "bg-amber-500",
    ringSelected: "ring-2 ring-amber-400 ring-offset-1",
    shadowSelected: "shadow-amber-100",
  },
  sky: {
    topBorder: "border-t-sky-500",
    iconBg: "bg-sky-500",
    ringSelected: "ring-2 ring-sky-400 ring-offset-1",
    shadowSelected: "shadow-sky-100",
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
}

export const NodeCard = ({
  selected,
  theme,
  icon: Icon,
  label,
  headerRight,
  children,
  bodyClassName,
}: NodeCardProps) => {
  const t = themeMap[theme];

  return (
    <div
      className={cn(
        "w-[248px] rounded-xl bg-white",
        "border border-gray-200 border-t-4",
        t.topBorder,
        "shadow-md transition-all duration-150",
        selected
          ? cn("shadow-lg", t.ringSelected, t.shadowSelected)
          : "hover:shadow-lg hover:border-gray-300",
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 px-3.5 py-2.5">
        <div
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
            t.iconBg,
          )}
        >
          <Icon className="h-4 w-4 text-white" />
        </div>
        <span className="flex-1 truncate text-sm font-semibold text-gray-800">
          {label}
        </span>
        {headerRight}
      </div>

      {/* Body */}
      {children && (
        <>
          <div className="h-px bg-gray-100" />
          <div className={cn("px-3.5 py-3", bodyClassName)}>{children}</div>
        </>
      )}
    </div>
  );
};
