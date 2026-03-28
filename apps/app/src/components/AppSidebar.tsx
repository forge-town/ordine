import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/cn";
import {
  LayoutDashboard,
  Workflow,
  BookOpen,
  Settings,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  FolderOpen,
  Layers,
} from "lucide-react";

interface NavItem {
  label: string;
  icon: React.ElementType;
  to: string;
  badge?: string;
}

const navItems: NavItem[] = [
  { label: "仪表盘", icon: LayoutDashboard, to: "/" },
  { label: "Pipelines", icon: Layers, to: "/pipelines" },
  { label: "Canvas", icon: Workflow, to: "/canvas", badge: "新" },
  { label: "项目", icon: FolderOpen, to: "/projects" },
  { label: "技能库", icon: BookOpen, to: "/skills" },
  { label: "AI 助手", icon: Sparkles, to: "/assistant" },
];

export const AppSidebar = () => {
  const [collapsed, setCollapsed] = useState(false);
  const { location } = useRouterState();
  const currentPath = location.pathname;

  return (
    <aside
      className={cn(
        "relative flex h-full flex-col border-r border-gray-200 bg-white transition-all duration-200",
        collapsed ? "w-14" : "w-52",
      )}
    >
      {/* Logo */}
      <div
        className={cn(
          "flex h-11 shrink-0 items-center border-b border-gray-100",
          collapsed ? "justify-center px-2" : "gap-2 px-4",
        )}
      >
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-violet-600">
          <Workflow className="h-3.5 w-3.5 text-white" />
        </div>
        {!collapsed && (
          <span className="text-sm font-bold tracking-tight text-gray-900">
            ordine
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3">
        <ul className="space-y-0.5 px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              currentPath === item.to ||
              (item.to !== "/" && currentPath.startsWith(item.to));
            return (
              <li key={item.to}>
                <Link
                  to={item.to as "/"}
                  className={cn(
                    "flex h-8 items-center gap-2.5 rounded-md px-2 text-sm transition-colors",
                    isActive
                      ? "bg-violet-50 font-medium text-violet-700"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0",
                      isActive ? "text-violet-600" : "text-gray-400",
                    )}
                  />
                  {!collapsed && (
                    <>
                      <span className="flex-1">{item.label}</span>
                      {item.badge && (
                        <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-600">
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Bottom */}
      <div className="border-t border-gray-100 p-2">
        <Link
          to="/settings"
          className={cn(
            "flex h-8 items-center gap-2.5 rounded-md px-2 text-sm transition-colors",
            currentPath === "/settings"
              ? "bg-violet-50 font-medium text-violet-700"
              : "text-gray-500 hover:bg-gray-100",
          )}
        >
          <Settings
            className={cn(
              "h-4 w-4 shrink-0",
              currentPath === "/settings" ? "text-violet-600" : "text-gray-400",
            )}
          />
          {!collapsed && <span>设置</span>}
        </Link>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="absolute -right-3 top-14 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-gray-200 bg-white shadow-sm hover:bg-gray-50"
        title={collapsed ? "展开侧栏" : "收起侧栏"}
      >
        {collapsed ? (
          <ChevronRight className="h-3 w-3 text-gray-500" />
        ) : (
          <ChevronLeft className="h-3 w-3 text-gray-500" />
        )}
      </button>
    </aside>
  );
};
