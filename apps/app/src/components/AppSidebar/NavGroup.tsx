import { ChevronDown } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import { Icon } from "@/components/primitives";
import { NavItem, type AppNavItem } from "./NavItem";

export type NavGroupProps = {
  activeKey: string;
  collapsible?: boolean;
  items: AppNavItem[];
  onToggle?: () => void;
  open?: boolean;
  title: string;
};

export const NavGroup = ({
  activeKey,
  collapsible = false,
  items,
  onToggle,
  open = true,
  title,
}: NavGroupProps) => {
  const handleToggle = () => {
    onToggle?.();
  };

  return (
    <div className="mt-3.5 first:mt-0">
      <div className="flex w-full items-center justify-between px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.11em] text-muted-foreground">
        <span>{title}</span>
        {collapsible ? (
          <button
            aria-label={`${title} toggle`}
            className="rounded p-0.5 hover:bg-accent/60"
            type="button"
            onClick={handleToggle}
          >
            <Icon
              className={cn("transition-transform", open ? "rotate-0" : "-rotate-90")}
              icon={ChevronDown}
              size={12}
            />
          </button>
        ) : null}
      </div>
      {open ? (
        <ul className="mt-1 space-y-0.5">
          {items.map((item) => (
            <NavItem key={item.key} active={activeKey === item.key} item={item} />
          ))}
        </ul>
      ) : null}
    </div>
  );
};
