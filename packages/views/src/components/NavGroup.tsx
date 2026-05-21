import type { ElementType } from "react";
import { Link } from "@tanstack/react-router";
import {
  SidebarGroup,
  SidebarGroupContent,
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

export const NavGroup = ({
  ariaLabel,
  items,
  currentPath,
  separated = false,
  t,
}: {
  ariaLabel: string;
  items: NavItem[];
  currentPath: string;
  separated?: boolean;
  t: (key: string) => string;
}) => (
  <>
    {separated && <SidebarSeparator className="my-1 bg-sidebar-border/60" />}
    <SidebarGroup aria-label={ariaLabel} className="p-0 px-2">
      <SidebarGroupContent>
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
                  className="h-8"
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
      </SidebarGroupContent>
    </SidebarGroup>
  </>
);
