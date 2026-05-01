import { useEffect, useState, type ElementType } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  LayoutDashboard,
  Workflow,
  BookOpen,
  Settings,
  Layers,
  FolderGit2,
  Lightbulb,
  Activity,
  ShieldCheck,
  Zap,
  ChefHat,
  FlaskConical,
  Box,
  Globe,
  Puzzle,
  ExternalLink,
  ChevronRight,
  Server,
  LogOut,
  ChevronsUpDown,
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
import { Avatar, AvatarFallback, AvatarImage } from "@repo/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/dropdown-menu";
import { pluginRegistry } from "@repo/plugin";
import { useSession, signOut } from "@/integrations/better-auth-client";

interface NavItem {
  labelKey: string;
  icon: ElementType;
  to: string;
  badge?: string;
}

type SidebarView = "main" | "pipeline";

const featuredItems: NavItem[] = [
  { labelKey: "nav.canvas", icon: Workflow, to: "/canvas" },
  { labelKey: "distillations.studioTitle", icon: FlaskConical, to: "/distillation-studio" },
];

const mainItems: NavItem[] = [{ labelKey: "nav.dashboard", icon: LayoutDashboard, to: "/" }];

const mainPeerItems: NavItem[] = [
  { labelKey: "nav.distillations", icon: FlaskConical, to: "/distillations" },
];

const pipelineItems: NavItem[] = [
  { labelKey: "nav.operations", icon: Zap, to: "/operations" },
  { labelKey: "nav.skills", icon: BookOpen, to: "/skills" },
  { labelKey: "nav.recipes", icon: ChefHat, to: "/recipes" },
  { labelKey: "nav.rules", icon: ShieldCheck, to: "/rules" },
  { labelKey: "nav.bestPractices", icon: Lightbulb, to: "/best-practices" },
  { labelKey: "nav.jobs", icon: Activity, to: "/jobs" },
];

const objectNavItems: NavItem[] = [{ labelKey: "nav.projects", icon: FolderGit2, to: "/projects" }];

const configItems: NavItem[] = [
  { labelKey: "nav.runtimes", icon: Server, to: "/runtimes" },
  { labelKey: "nav.settings", icon: Settings, to: "/settings" },
];

const iconMap: Record<string, ElementType> = {
  globe: Globe,
  github: FolderGit2,
  box: Box,
  puzzle: Puzzle,
};

const getPluginObjectNavItems = (): NavItem[] => {
  return pluginRegistry.getAllObjectTypes().map((objType) => ({
    labelKey: objType.label,
    icon: iconMap[objType.icon ?? ""] ?? Puzzle,
    to: `/objects/${objType.id}`,
  }));
};

const isPipelinePath = (path: string) => {
  return (
    path === "/pipelines" ||
    path.startsWith("/pipelines/") ||
    pipelineItems.some((item) => path === item.to || path.startsWith(`${item.to}/`))
  );
};

const NavGroup = ({
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
            const isActive =
              currentPath === item.to || (item.to !== "/" && currentPath.startsWith(item.to));

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

export const AppSidebar = () => {
  const { location } = useRouterState();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { data: session } = useSession();
  const currentPath = location.pathname;
  const [sidebarView, setSidebarView] = useState<SidebarView>(() =>
    isPipelinePath(currentPath) ? "pipeline" : "main"
  );
  const pluginObjectItems = getPluginObjectNavItems();
  const allObjectItems = [...objectNavItems, ...pluginObjectItems];
  const pipelineActive = isPipelinePath(currentPath);

  useEffect(() => {
    if (isPipelinePath(currentPath)) {
      setSidebarView("pipeline");

      return;
    }
    setSidebarView("main");
  }, [currentPath]);

  const handleShowPipelineView = () => setSidebarView("pipeline");
  const handleShowMainView = () => setSidebarView("main");
  const handleLogout = async () => {
    await signOut();
    navigate({ to: "/login" });
  };

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
          {featuredItems.map((item) => {
            const Icon = item.icon;
            const label = t(item.labelKey);
            const isActive =
              currentPath === item.to || (item.to !== "/" && currentPath.startsWith(item.to));

            return (
              <SidebarMenuItem key={item.to}>
                <SidebarMenuButton
                  className="h-8 font-medium"
                  isActive={isActive}
                  render={<Link to={item.to as "/"} />}
                  tooltip={label}
                >
                  <Icon />
                  <span>{label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </div>

      <SidebarContent className="py-2">
        {sidebarView === "main" ? (
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
                      onClick={handleShowPipelineView}
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
            <SidebarSeparator className="my-1 bg-sidebar-border/60" />
            <SidebarGroup aria-label={t("nav.objects")} className="p-0 px-2">
              <SidebarGroupContent>
                <SidebarMenu>
                  {allObjectItems.map((item) => {
                    const Icon = item.icon;
                    const label = item.labelKey.startsWith("nav.")
                      ? t(item.labelKey)
                      : item.labelKey;
                    const isActive =
                      currentPath === item.to ||
                      (item.to !== "/" && currentPath.startsWith(item.to));

                    return (
                      <SidebarMenuItem key={item.to}>
                        <SidebarMenuButton
                          className="h-8"
                          isActive={isActive}
                          render={<Link to={item.to as "/"} />}
                          tooltip={label}
                        >
                          <Icon />
                          <span>{label}</span>
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
                      onClick={handleShowMainView}
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

      {/* User info + GitHub at bottom */}
      <SidebarFooter className="border-t p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-sidebar-accent"
                render={<button type="button" />}
              >
                <Avatar size="sm">
                  {session?.user?.image && (
                    <AvatarImage alt={session.user.name ?? ""} src={session.user.image} />
                  )}
                  <AvatarFallback>
                    {session?.user?.name?.charAt(0).toUpperCase() ?? "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-1 flex-col overflow-hidden group-data-[state=collapsed]/sidebar:hidden">
                  <span className="truncate text-xs font-medium">
                    {session?.user?.name ?? "User"}
                  </span>
                  <span className="truncate text-[10px] text-muted-foreground">
                    {session?.user?.email ?? ""}
                  </span>
                </div>
                <ChevronsUpDown className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground group-data-[state=collapsed]/sidebar:hidden" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56" side="top">
                <DropdownMenuItem className="cursor-pointer" onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>{t("nav.logout")}</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
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
