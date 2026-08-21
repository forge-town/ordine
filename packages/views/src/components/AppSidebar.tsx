import { useEffect, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useStore } from "zustand";
import {
  Activity,
  BookOpen,
  Bot,
  Box,
  Boxes,
  ChevronDown,
  Cpu,
  ExternalLink,
  FlaskConical,
  Gauge,
  Layers,
  Plug,
  Puzzle,
  Search,
  Settings,
  SquarePen,
  Workflow,
  Zap,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from "@repo/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/dropdown-menu";
import { Button } from "@repo/ui/button";
import { cn } from "@repo/ui/lib/utils";
import { useSidebarStore } from "../store/sidebarStore";
import { NavGroup, NavItems, type NavItem } from "./NavGroup";
import { DefaultUserFooter, ProjectSwitcher } from "./ProjectSwitcher";
import { NotificationCenter } from "./NotificationCenter";

const assemblyItems: NavItem[] = [
  { labelKey: "nav.pipelines", icon: Layers, to: "/pipelines", exact: true },
  { labelKey: "nav.components", icon: Boxes, to: "/components" },
  { labelKey: "nav.operations", icon: Zap, to: "/pipelines/operations" },
  { labelKey: "nav.objects", icon: Box, to: "/pipelines/objects" },
];

const monitorItems: NavItem[] = [
  { labelKey: "nav.jobs", icon: Activity, to: "/pipelines/jobs" },
  { labelKey: "nav.items.usage", icon: Gauge, to: "/usage" },
  { labelKey: "nav.distillations", icon: FlaskConical, to: "/distillations" },
];

const capabilityItems: NavItem[] = [
  { labelKey: "nav.agents", icon: Bot, to: "/agents" },
  { labelKey: "nav.items.localAgents", icon: Cpu, to: "/local-agents" },
  { labelKey: "nav.skills", icon: BookOpen, to: "/skills" },
  { labelKey: "nav.items.connectors", icon: Plug, to: "/connectors" },
  { labelKey: "nav.plugins", icon: Puzzle, to: "/plugins" },
];

export interface AppSidebarProps {
  footer?: ReactNode;
  onNewPipeline?: () => void;
  onSearch?: () => void;
}

const DefaultFooter = () => (
  <SidebarMenu>
    <SidebarMenuItem>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-sidebar-accent"
          render={<Button type="button" variant="ghost" />}
        >
          <DefaultUserFooter />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56" side="top">
          <DropdownMenuItem
            render={
              <a
                href="https://github.com/forge-town/ordine"
                rel="noopener noreferrer"
                target="_blank"
              />
            }
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            <span>GitHub</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  </SidebarMenu>
);

export const AppSidebar = ({
  footer,
  onNewPipeline: handleNewPipeline,
  onSearch: handleSearch,
}: AppSidebarProps) => {
  const { location } = useRouterState();
  const { t } = useTranslation();
  const { state: sidebarState } = useSidebar();
  const store = useSidebarStore();
  const capabilitiesOpen = useStore(store, (state) => state.capabilitiesOpen);
  const handleSidebarLocationChange = useStore(store, (state) => state.handleSidebarLocationChange);
  const handleCapabilitiesToggle = useStore(store, (state) => state.handleCapabilitiesToggle);
  const handleDefaultSearch = useStore(store, (state) => state.handleSearchButtonClick);
  const handleSearchClick = handleSearch ?? handleDefaultSearch;
  const currentPath = location.pathname;

  useEffect(() => {
    handleSidebarLocationChange(currentPath);
  }, [currentPath, handleSidebarLocationChange]);

  return (
    <Sidebar className="border-r bg-sidebar" collapsible="icon">
      <SidebarHeader className="border-b px-2 py-2">
        <div className="relative flex h-8 items-center">
          <div
            aria-hidden={sidebarState === "collapsed"}
            className="pointer-events-none flex w-full max-w-full min-w-0 items-center gap-2 overflow-hidden pr-9 transition-[max-width,opacity,transform] duration-200 ease-out motion-reduce:transition-none group-data-[state=collapsed]/sidebar:max-w-0 group-data-[state=collapsed]/sidebar:-translate-x-1 group-data-[state=collapsed]/sidebar:opacity-0"
          >
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary">
              <Workflow className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
            <span className="truncate text-sm font-bold">ordine</span>
          </div>
          <SidebarTrigger className="absolute right-0.5 top-0.5 z-10 shrink-0 rounded-md shadow-none transition-[right] duration-200 ease-out motion-reduce:transition-none active:translate-y-0! focus-visible:border-transparent focus-visible:ring-2 focus-visible:ring-inset group-data-[state=collapsed]/sidebar:right-[calc(50%_-_0.875rem)]" />
        </div>
        <ProjectSwitcher />
        <SidebarMenu className="gap-1">
          <SidebarMenuItem>
            <SidebarMenuButton
              className="h-8 text-foreground/70"
              tooltip={t("nav.search")}
              onClick={handleSearchClick}
            >
              <Search />
              <span className="truncate">{t("nav.search")}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          {handleNewPipeline && (
            <SidebarMenuItem>
              <SidebarMenuButton
                className="h-8 text-foreground/70"
                tooltip={t("nav.newPipeline")}
                onClick={handleNewPipeline}
              >
                <SquarePen />
                <span className="truncate">{t("nav.newPipeline")}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="py-2">
        <NavGroup
          ariaLabel={t("nav.groups.assembly", { defaultValue: "Assembly" })}
          currentPath={currentPath}
          items={assemblyItems}
          label={t("nav.groups.assembly", { defaultValue: "Assembly" })}
          t={t}
        />
        <NavGroup
          ariaLabel={t("nav.groups.monitor", { defaultValue: "Monitor" })}
          currentPath={currentPath}
          items={monitorItems}
          label={t("nav.groups.monitor", { defaultValue: "Monitor" })}
          t={t}
        />
        <SidebarSeparator className="my-1 bg-sidebar-border/60" />
        <SidebarGroup
          aria-label={t("nav.groups.capabilities", { defaultValue: "Capabilities" })}
          className="px-2! py-0!"
        >
          <SidebarGroupLabel
            className="h-7 px-2 text-[11px] font-medium uppercase text-foreground/70 group-data-[collapsible=icon]:sr-only"
            render={
              <button
                aria-expanded={capabilitiesOpen}
                className="flex w-full items-center gap-2 rounded-md text-left hover:text-foreground"
                type="button"
                onClick={handleCapabilitiesToggle}
              />
            }
          >
            <span>{t("nav.groups.capabilities", { defaultValue: "Capabilities" })}</span>
            <ChevronDown
              className={cn("ml-auto transition-transform", !capabilitiesOpen && "-rotate-90")}
            />
          </SidebarGroupLabel>
          {capabilitiesOpen && (
            <SidebarGroupContent>
              <NavItems currentPath={currentPath} items={capabilityItems} t={t} />
            </SidebarGroupContent>
          )}
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <NotificationCenter />
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="h-8 text-foreground/70"
              isActive={currentPath === "/settings"}
              render={<Link to="/settings" />}
              tooltip={t("nav.settings")}
            >
              <Settings />
              <span>{t("nav.settings")}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        {footer ?? <DefaultFooter />}
      </SidebarFooter>
      <SidebarRail resizable />
    </Sidebar>
  );
};
