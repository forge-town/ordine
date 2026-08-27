import { useEffect, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useStore } from "zustand";
import {
  Bot,
  CalendarClock,
  Layers,
  MessageSquare,
  Puzzle,
  Search,
  Settings,
  SquarePen,
  Workflow,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@repo/ui/sidebar";
import { useSidebarStore } from "../store/sidebarStore";
import { NavGroup, type NavItem } from "./NavGroup";
import { DefaultUserFooter, ProjectSwitcher } from "./ProjectSwitcher";
import { NotificationCenter } from "./NotificationCenter";

const mainItems: NavItem[] = [
  { labelKey: "nav.pipelines", icon: Layers, to: "/pipelines", exact: true },
  { labelKey: "nav.schedule", icon: CalendarClock, to: "/schedule" },
  { labelKey: "nav.plugins", icon: Puzzle, to: "/plugins" },
  { labelKey: "nav.agents", icon: Bot, to: "/agents" },
  { labelKey: "nav.conversations", icon: MessageSquare, to: "/assistant" },
];

export interface AppSidebarProps {
  footer?: ReactNode;
  onNewPipeline?: () => void;
  onSearch?: () => void;
}

const DefaultFooter = () => (
  <SidebarMenu>
    <SidebarMenuItem>
      <div className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm">
        <DefaultUserFooter />
      </div>
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
  const handleSidebarLocationChange = useStore(store, (state) => state.handleSidebarLocationChange);
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
          ariaLabel={t("nav.groups.main", { defaultValue: "Main" })}
          currentPath={currentPath}
          items={mainItems}
          t={t}
        />
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
