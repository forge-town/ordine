import { cn } from "@repo/ui/lib/utils";

export type NodeTheme = "emerald" | "violet" | "amber" | "sky";

const themeMap = {
  emerald: {
    wrapperText: "text-emerald-900",
    borderBase: "border-emerald-100/60",
    borderHover: "hover:border-emerald-300/80",
    borderSelected: "border-emerald-500 ring-1 ring-emerald-500 shadow-[0_0_20px_-3px_rgba(16,185,129,0.15)]",
    headerBg: "bg-gradient-to-b from-emerald-50/50 to-transparent",
    iconBg: "bg-emerald-100/80",
    iconColor: "text-emerald-600",
    shadow: "shadow-sm shadow-emerald-900/5",
  },
  violet: {
    wrapperText: "text-violet-900",
    borderBase: "border-violet-100/60",
    borderHover: "hover:border-violet-300/80",
    borderSelected: "border-violet-500 ring-1 ring-violet-500 shadow-[0_0_20px_-3px_rgba(139,92,246,0.15)]",
    headerBg: "bg-gradient-to-b from-violet-50/50 to-transparent",
    iconBg: "bg-violet-100/80",
    iconColor: "text-violet-600",
    shadow: "shadow-sm shadow-violet-900/5",
  },
  amber: {
    wrapperText: "text-amber-900",
    borderBase: "border-amber-100/60",
    borderHover: "hover:border-amber-300/80",
    borderSelected: "border-amber-500 ring-1 ring-amber-500 shadow-[0_0_20px_-3px_rgba(245,158,11,0.15)]",
    headerBg: "bg-gradient-to-b from-amber-50/50 to-transparent",
    iconBg: "bg-amber-100/80",
    iconColor: "text-amber-600",
    shadow: "shadow-sm shadow-amber-900/5",
  },
  sky: {
    wrapperText: "text-sky-900",
    borderBase: "border-sky-100/60",
    borderHover: "hover:border-sky-300/80",
    borderSelected: "border-sky-500 ring-1 ring-sky-500 shadow-[0_0_20px_-3px_rgba(14,165,233,0.15)]",
    headerBg: "bg-gradient-to-b from-sky-50/50 to-transparent",
    iconBg: "bg-sky-100/80",
    iconColor: "text-sky-600",
    shadow: "shadow-sm shadow-sky-900/5",
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
  /** Card width size: sm (default) = 180px, md = 200px */
  size?: "sm" | "md";
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
  size = "sm",
}: NodeCardProps) => {
  const t = themeMap[theme];

  return (
    <div
      className={cn(
        size === "md" ? "min-w-[200px]" : "min-w-[180px]",
        "w-[260px] rounded-xl bg-white/95 backdrop-blur-md",
        "border transition-all duration-300 ease-out",
        t.borderBase,
        t.shadow,
        t.wrapperText,
        selected
          ? t.borderSelected
          : cn("hover:shadow-md", t.borderHover),
      )}
    >
      {/* Header */}
      <div className={cn("relative flex items-center justify-between px-4 py-3 rounded-t-xl overflow-hidden", t.headerBg)}>
        <div className="flex items-center gap-3 relative z-10 w-full">
          <div
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg shadow-sm ring-1 ring-black/5",
              t.iconBg,
            )}
          >
            <Icon className={cn("h-4 w-4", t.iconColor)} />
          </div>
          <div className="flex flex-col flex-1 min-w-0">
            <span className="truncate text-[13px] font-semibold tracking-tight text-slate-800">
              {label}
            </span>
            {description && (
              <span className="truncate text-[11px] text-slate-500 font-medium">
                {description}
              </span>
            )}
          </div>
          {headerRight && <div className="shrink-0 z-10 relative">{headerRight}</div>}
        </div>
        {/* Subtle bottom separator line via pseudo element */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent opacity-60" />
      </div>

      {/* Body */}
      {children && (
        <div className={cn("px-4 py-3.5", bodyClassName)}>{children}</div>
      )}
    </div>
  );
};
