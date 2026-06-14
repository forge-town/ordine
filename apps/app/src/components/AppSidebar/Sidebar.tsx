import { Boxes, Cpu, Gauge, ListChecks, Plug, Sparkles, Workflow } from "lucide-react";
import { useList } from "@refinedev/core";
import { useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { SearchInput } from "@/components/primitives";
import { ResourceName } from "@/integrations/refine/dataProvider";
import { useSidebarStore } from "@/store/sidebarStore";
import { NavGroup } from "./NavGroup";
import { ProjectSwitcher } from "./ProjectSwitcher";
import { UserFooter } from "./UserFooter";
import type { AppNavItem } from "./NavItem";

type NavigationGroup = {
  collapsible?: boolean;
  items: AppNavItem[];
  title: string;
};

const getActiveKey = (pathname: string) => {
  if (pathname.startsWith("/workspace")) return "pipelines";
  if (pathname.startsWith("/components")) return "components";
  if (pathname.startsWith("/jobs")) return "jobs";
  if (pathname.startsWith("/usage")) return "usage";
  if (pathname.startsWith("/local-agents")) return "agents";
  if (pathname.startsWith("/skills")) return "skills";
  if (pathname.startsWith("/connectors")) return "connectors";
  if (pathname.startsWith("/pipelines")) return "pipelines";

  return "pipelines";
};

const getTotalLabel = (total?: number) => {
  return total === undefined ? undefined : total;
};

const handleSidebarCollapse = () => {};

export const AppSidebar = () => {
  const { t } = useTranslation();
  const { location } = useRouterState();
  const store = useSidebarStore();
  const capabilitiesOpen = useStore(store, (s) => s.capabilitiesOpen);
  const sidebarSearchQuery = useStore(store, (s) => s.sidebarSearchQuery);
  const handleCapabilitiesToggle = useStore(store, (s) => s.handleCapabilitiesToggle);
  const handleSidebarSearchChange = useStore(store, (s) => s.handleSidebarSearchChange);
  const handleSidebarSearchClear = useStore(store, (s) => s.handleSidebarSearchClear);
  const { result: pipelines } = useList({
    queryOptions: { retry: false },
    resource: ResourceName.pipelines,
  });
  // G3-07：Components 页展示的是组件库（pipelineAssets），徽标必须同源——
  // 原先取 operations.total（15）与页面实际组件数（6）不一致。
  const { result: pipelineAssets } = useList({
    queryOptions: { retry: false },
    resource: ResourceName.pipelineAssets,
  });
  const { result: jobs } = useList({
    queryOptions: { retry: false },
    resource: ResourceName.jobs,
  });
  const activeKey = getActiveKey(location.pathname);
  const normalizedQuery = sidebarSearchQuery.trim().toLowerCase();

  const groups: NavigationGroup[] = [
    {
      title: t("nav.groups.assembly"),
      items: [
        {
          badge: getTotalLabel(pipelines?.total),
          icon: Workflow,
          key: "pipelines",
          label: t("nav.items.pipelines"),
          to: "/pipelines",
        },
        {
          badge: getTotalLabel(pipelineAssets?.total),
          icon: Boxes,
          key: "components",
          label: t("nav.items.components"),
          to: "/components",
        },
      ],
    },
    {
      title: t("nav.groups.monitor"),
      items: [
        {
          badge: getTotalLabel(jobs?.total),
          icon: ListChecks,
          key: "jobs",
          label: t("nav.items.jobs"),
          to: "/jobs",
        },
        {
          icon: Gauge,
          key: "usage",
          label: t("nav.items.usage"),
          to: "/usage",
        },
      ],
    },
    {
      collapsible: true,
      title: t("nav.groups.capabilities"),
      items: [
        {
          icon: Cpu,
          key: "agents",
          label: t("nav.items.localAgents"),
          to: "/local-agents",
        },
        {
          icon: Sparkles,
          key: "skills",
          label: t("nav.items.skills"),
          to: "/skills",
        },
        {
          icon: Plug,
          key: "connectors",
          label: t("nav.items.connectors"),
          to: "/connectors",
        },
      ],
    },
  ];
  const filteredGroups = groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => item.label.toLowerCase().includes(normalizedQuery)),
    }))
    .filter((group) => normalizedQuery === "" || group.items.length > 0);

  return (
    <aside className="flex h-screen w-[236px] shrink-0 flex-col border-r border-border/70 bg-surface">
      <ProjectSwitcher onCollapse={handleSidebarCollapse} />
      <div className="mt-2.5 px-3">
        <SearchInput
          placeholder="Search..."
          value={sidebarSearchQuery}
          onChange={handleSidebarSearchChange}
          onClear={handleSidebarSearchClear}
        />
      </div>
      <nav className="no-bar mt-3.5 flex-1 overflow-y-auto px-2 pb-2">
        {filteredGroups.length === 0 ? (
          <div className="px-3 py-6 text-center text-[11.5px] text-muted-foreground">
            No matches for "{sidebarSearchQuery}"
          </div>
        ) : null}
        {filteredGroups.map((group) => (
          <NavGroup
            key={group.title}
            activeKey={activeKey}
            collapsible={group.collapsible}
            items={group.items}
            open={group.collapsible ? capabilitiesOpen : true}
            title={group.title}
            onToggle={handleCapabilitiesToggle}
          />
        ))}
      </nav>
      <UserFooter />
    </aside>
  );
};
