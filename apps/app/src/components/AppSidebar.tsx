import { Link, useRouterState } from "@tanstack/react-router";
import {
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
  SidebarTrigger,
} from "@repo/ui/sidebar";
import { Badge } from "@repo/ui/badge";
import { cn } from "@repo/ui/lib/utils";
import { pluginRegistry } from "@repo/plugin";

interface NavItem {
  labelKey: string;
  icon: React.ElementType;
  to: string;
  badge?: string;
}

const featuredItems: NavItem[] = [
  { labelKey: "nav.canvas", icon: Workflow, to: "/canvas" },
  { labelKey: "nav.distillations", icon: FlaskConical, to: "/distillations" },
];

const workspaceItems: NavItem[] = [
  { labelKey: "nav.dashboard", icon: LayoutDashboard, to: "/" },
  { labelKey: "nav.pipelines", icon: Layers, to: "/pipelines" },
  { labelKey: "nav.jobs", icon: Activity, to: "/jobs" },
];

const libraryItems: NavItem[] = [
  { labelKey: "nav.operations", icon: Zap, to: "/operations" },
  { labelKey: "nav.skills", icon: BookOpen, to: "/skills" },
  { labelKey: "nav.recipes", icon: ChefHat, to: "/recipes" },
  { labelKey: "nav.rules", icon: ShieldCheck, to: "/rules" },
];

const knowledgeItems: NavItem[] = [
  { labelKey: "nav.bestPractices", icon: Lightbulb, to: "/best-practices" },
];

const objectNavItems: NavItem[] = [{ labelKey: "nav.projects", icon: FolderGit2, to: "/projects" }];

const iconMap: Record<string, React.ElementType> = {
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

const NavGroup = ({
  label,
  items,
  currentPath,
  t,
}: {
  label: string;
  items: NavItem[];
  currentPath: string;
  t: (key: string) => string;
}) => (
  <SidebarGroup className="p-0 px-2">
    <SidebarGroupLabel>{label}</SidebarGroupLabel>
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
);

export const AppSidebar = () => {
  const { location } = useRouterState();
  const { t } = useTranslation();
  const currentPath = location.pathname;
  const pluginObjectItems = getPluginObjectNavItems();
  const allObjectItems = [...objectNavItems, ...pluginObjectItems];

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

      {/* Featured — Canvas + Distillations */}
      <div className="shrink-0 space-y-1 border-b border-sidebar-border px-2 py-2">
        {featuredItems.map((item) => {
          const Icon = item.icon;
          const label = t(item.labelKey);
          const isActive =
            currentPath === item.to || (item.to !== "/" && currentPath.startsWith(item.to));

          return (
            <Link
              key={item.to}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-accent/80",
                "group-data-[state=collapsed]/sidebar:justify-center group-data-[state=collapsed]/sidebar:px-0",
              )}
              to={item.to}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="group-data-[state=collapsed]/sidebar:hidden">{label}</span>
            </Link>
          );
        })}
      </div>

      <SidebarContent className="py-2">
        <NavGroup currentPath={currentPath} items={workspaceItems} label={t("nav.workspace")} t={t} />
        <NavGroup currentPath={currentPath} items={libraryItems} label={t("nav.library")} t={t} />
        <NavGroup
          currentPath={currentPath}
          items={knowledgeItems}
          label={t("nav.knowledge")}
          t={t}
        />
        <SidebarGroup className="p-0 px-2">
          <SidebarGroupLabel>
            <Box className="mr-1 h-3.5 w-3.5" />
            {t("nav.objects")}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {allObjectItems.map((item) => {
                const Icon = item.icon;
                const label = item.labelKey.startsWith("nav.") ? t(item.labelKey) : item.labelKey;
                const isActive =
                  currentPath === item.to || (item.to !== "/" && currentPath.startsWith(item.to));

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
      </SidebarContent>

      {/* Settings at bottom */}
      <SidebarFooter className="border-t p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="h-8"
              isActive={currentPath === "/settings"}
              render={<Link to="/settings" />}
              tooltip={t("nav.settings")}
            >
              <Settings />
              <span>{t("nav.settings")}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
};
