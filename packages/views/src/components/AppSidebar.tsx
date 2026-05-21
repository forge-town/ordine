import { useEffect } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useStore } from "zustand";
import {
  ArrowLeft,
  Bot,
  LayoutDashboard,
  Workflow,
  BookOpen,
  Settings,
  Layers,
  Activity,
  Zap,
  FlaskConical,
  Box,
  Puzzle,
  Eye,
  ChevronRight,
  Server,
  ChevronsUpDown,
  Search,
  SquarePen,
  ExternalLink,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  SidebarTrigger,
} from "@repo/ui/sidebar";
import { Badge } from "@repo/ui/badge";
import { Button } from "@repo/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/dropdown-menu";
import { useSidebarStore, SidebarView } from "../store/sidebarStore";
import { NavGroup, type NavItem } from "./NavGroup";

const mainItems: NavItem[] = [{ labelKey: "nav.dashboard", icon: LayoutDashboard, to: "/" }];

const mainPeerItems: NavItem[] = [
  { labelKey: "nav.distillations", icon: FlaskConical, to: "/distillations" },
  { labelKey: "nav.skills", icon: BookOpen, to: "/skills" },
];

const pipelineItems: NavItem[] = [
  { labelKey: "nav.preview", icon: Eye, to: "/pipelines", exact: true },
  { labelKey: "nav.objects", icon: Box, to: "/pipelines/objects" },
  { labelKey: "nav.operations", icon: Zap, to: "/pipelines/operations" },
  { labelKey: "nav.jobs", icon: Activity, to: "/pipelines/jobs" },
];

const configItems: NavItem[] = [
  { labelKey: "nav.agents", icon: Bot, to: "/agents" },
  { labelKey: "nav.plugins", icon: Puzzle, to: "/plugins" },
  { labelKey: "nav.runtimes", icon: Server, to: "/runtimes" },
  { labelKey: "nav.settings", icon: Settings, to: "/settings" },
];

const isPipelinePath = (path: string) => {
  return (
    path === "/pipelines" ||
    path.startsWith("/pipelines/") ||
    pipelineItems.some((item) => path === item.to || path.startsWith(`${item.to}/`))
  );
};

export const AppSidebar = () => {
  const { location } = useRouterState();
  const { t } = useTranslation();
  const store = useSidebarStore();
  const sidebarView = useStore(store, (s) => s.view);
  const handleSidebarLocationChange = useStore(store, (s) => s.handleSidebarLocationChange);
  const handleSidebarPipelineViewButtonClick = useStore(
    store,
    (s) => s.handleSidebarPipelineViewButtonClick,
  );
  const handleSidebarMainViewButtonClick = useStore(
    store,
    (s) => s.handleSidebarMainViewButtonClick,
  );
  const handleSearchButtonClick = useStore(store, (s) => s.handleSearchButtonClick);
  const handleNewPipelineButtonClick = useStore(store, (s) => s.handleNewPipelineButtonClick);
  const currentPath = location.pathname;
  const pipelineActive = isPipelinePath(currentPath);

  useEffect(() => {
    handleSidebarLocationChange(currentPath);
  }, [currentPath, handleSidebarLocationChange]);

  return (
    <Sidebar className="border-r bg-sidebar" collapsible="icon">
      {/* Logo + collapse trigger */}
      <SidebarHeader className="h-11 flex-row items-center justify-between border-b px-3 py-0">
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary">
            <Workflow className="h-3.5 w-3.5 text-primary-foreground" />
          </div>
          <span className="truncate text-sm font-bold tracking-tight group-data-[state=collapsed]/sidebar:hidden">
            ordine
          </span>
        </div>
        <SidebarTrigger className="shrink-0" />
      </SidebarHeader>

      <div className="shrink-0 border-b border-sidebar-border px-2 py-2">
        <SidebarMenu className="gap-1">
          <SidebarMenuItem>
            <SidebarMenuButton
              className="h-8 text-muted-foreground"
              tooltip={t("nav.search")}
              onClick={handleSearchButtonClick}
            >
              <Search />
              <span>{t("nav.search")}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="h-8 text-muted-foreground"
              tooltip={t("nav.newPipeline")}
              onClick={handleNewPipelineButtonClick}
            >
              <SquarePen />
              <span>{t("nav.newPipeline")}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </div>

      <SidebarContent className="py-2">
        {sidebarView === SidebarView.Main ? (
          <div className="animate-in fade-in-0 slide-in-from-left-1 duration-150">
            <NavGroup
              ariaLabel={t("nav.workspace")}
              currentPath={currentPath}
              items={mainItems}
              t={t}
            />
            <SidebarGroup aria-label={t("nav.pipelines")} className="p-0 px-2">
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      className="h-8"
                      isActive={pipelineActive}
                      render={<Link to="/pipelines" />}
                      tooltip={t("nav.pipelines")}
                      onClick={handleSidebarPipelineViewButtonClick}
                    >
                      <Layers />
                      <span>{t("nav.pipelines")}</span>
                      <ChevronRight className="ml-auto group-data-[state=collapsed]/sidebar:hidden" />
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            <NavGroup
              ariaLabel={t("nav.distillations")}
              currentPath={currentPath}
              items={mainPeerItems}
              t={t}
            />
            <NavGroup
              separated
              ariaLabel="Configure"
              currentPath={currentPath}
              items={configItems}
              t={t}
            />
          </div>
        ) : (
          <div className="animate-in fade-in-0 slide-in-from-right-1 duration-150">
            <SidebarGroup className="p-0 px-2">
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      className="h-8 font-medium"
                      tooltip={t("nav.back")}
                      onClick={handleSidebarMainViewButtonClick}
                    >
                      <ArrowLeft />
                      <span>{t("nav.pipelines")}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            <SidebarSeparator className="my-1 bg-sidebar-border/60" />
            <NavGroup
              ariaLabel={t("nav.pipelines")}
              currentPath={currentPath}
              items={pipelineItems}
              t={t}
            />
          </div>
        )}
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className="border-t p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-sidebar-accent"
                render={<Button type="button" variant="ghost" />}
              >
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted">
                  <Workflow className="h-3.5 w-3.5" />
                </div>
                <div className="flex flex-1 flex-col overflow-hidden group-data-[state=collapsed]/sidebar:hidden">
                  <span className="truncate text-xs font-medium">Ordine Desktop</span>
                </div>
                <ChevronsUpDown className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground group-data-[state=collapsed]/sidebar:hidden" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56" side="top">
                <DropdownMenuItem
                  className="cursor-pointer"
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
      </SidebarFooter>
    </Sidebar>
  );
};
