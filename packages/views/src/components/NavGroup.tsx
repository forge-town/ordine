import type { ElementType } from "react";
import { Link } from "@tanstack/react-router";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@repo/ui/sidebar";
import { Badge } from "@repo/ui/badge";

export interface NavItem {
  labelKey: string;
  icon: ElementType;
  to: string;
  badge?: string;
  exact?: boolean;
}

export const NavItems = ({
  items,
  currentPath,
  t,
}: {
  items: NavItem[];
  currentPath: string;
  t: (key: string) => string;
}) => (
  <SidebarMenu>
    {items.map((item) => {
      const Icon = item.icon;
      const labelText = t(item.labelKey);
      const isActive = item.exact
        ? currentPath === item.to
        : currentPath === item.to || (item.to !== "/" && currentPath.startsWith(item.to));

      return (
        <SidebarMenuItem key={item.to}>
          <SidebarMenuButton
            className="h-8 rounded-lg text-[13px] data-[active=true]:font-medium"
            isActive={isActive}
            render={<Link to={item.to as "/"} />}
            tooltip={labelText}
          >
            <Icon />
            <span>{labelText}</span>
            {item.badge && (
              <Badge
                className="ml-auto h-4 px-1.5 text-[10px] group-data-[state=collapsed]/sidebar:hidden"
                variant="secondary"
              >
                {item.badge}
              </Badge>
            )}
          </SidebarMenuButton>
        </SidebarMenuItem>
      );
    })}
  </SidebarMenu>
);

export const NavGroup = ({
  ariaLabel,
  label,
  items,
  currentPath,
  separated = false,
  t,
}: {
  ariaLabel: string;
  label?: string;
  items: NavItem[];
  currentPath: string;
  separated?: boolean;
  t: (key: string) => string;
}) => (
  <>
    {separated && <SidebarSeparator className="my-1 bg-sidebar-border/60" />}
    <SidebarGroup aria-label={ariaLabel} className="px-2! py-0!">
      {label && (
        <SidebarGroupLabel className="h-8 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/70 group-data-[collapsible=icon]:sr-only">
          {label}
        </SidebarGroupLabel>
      )}
      <SidebarGroupContent>
        <NavItems currentPath={currentPath} items={items} t={t} />
      </SidebarGroupContent>
    </SidebarGroup>
  </>
);
