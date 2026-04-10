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
  SidebarTrigger,
} from "@repo/ui/sidebar";
import { Badge } from "@repo/ui/badge";
import { cn } from "@repo/ui/lib/utils";

interface NavItem {
  labelKey: string;
  icon: React.ElementType;
  to: string;
  badge?: string;
}

const navItems: NavItem[] = [
  { labelKey: "nav.dashboard", icon: LayoutDashboard, to: "/" },
  { labelKey: "nav.projects", icon: FolderGit2, to: "/projects" },
  { labelKey: "nav.pipelines", icon: Layers, to: "/pipelines" },
  { labelKey: "nav.skills", icon: BookOpen, to: "/skills" },
  { labelKey: "nav.bestPractices", icon: Lightbulb, to: "/best-practices" },
  { labelKey: "nav.recipes", icon: ChefHat, to: "/recipes" },
  { labelKey: "nav.operations", icon: Zap, to: "/operations" },
  { labelKey: "nav.rules", icon: ShieldCheck, to: "/rules" },
  { labelKey: "nav.jobs", icon: Activity, to: "/jobs" },
];

export const AppSidebar = () => {
  const { location } = useRouterState();
  const { t } = useTranslation();
  const currentPath = location.pathname;

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
      {/* Canvas — special featured button */}
      <div className="shrink-0 border-b border-sidebar-border px-2 py-2">
        <Link
          className={cn(
            "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold transition-colors",
            "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-sm hover:from-violet-500 hover:to-indigo-500",
            "group-data-[state=collapsed]/sidebar:justify-center group-data-[state=collapsed]/sidebar:px-0"
          )}
          to="/canvas"
        >
          <Workflow className="h-4 w-4 shrink-0" />
          <span className="group-data-[state=collapsed]/sidebar:hidden">Canvas</span>
          <span className="ml-auto rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] font-bold leading-none group-data-[state=collapsed]/sidebar:hidden">
            新
          </span>
        </Link>
      </div>
      {/* Nav */}
      <SidebarContent className="py-2">
        <SidebarGroup className="p-0 px-2">
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const Icon = item.icon;
                const label = t(item.labelKey);
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
