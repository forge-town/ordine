import type { LucideIcon } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { cn } from "@repo/ui/lib/utils";
import { Icon } from "@/components/primitives";

export type AppNavItem = {
  badge?: number | string;
  icon: LucideIcon;
  key: string;
  label: string;
  to: string;
};

export type NavItemProps = {
  active: boolean;
  item: AppNavItem;
};

export const NavItem = ({ active, item }: NavItemProps) => {
  return (
    <li>
      <Link
        className={cn(
          "group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-[13px] transition-colors",
          active ? "bg-accent text-foreground" : "text-foreground/85 hover:bg-accent/55",
        )}
        to={item.to as "/"}
      >
        <Icon className="text-foreground/70" icon={item.icon} size={15} />
        <span className="flex-1 text-left tracking-tightish">{item.label}</span>
        {item.badge === undefined ? null : (
          <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            {item.badge}
          </span>
        )}
      </Link>
    </li>
  );
};
