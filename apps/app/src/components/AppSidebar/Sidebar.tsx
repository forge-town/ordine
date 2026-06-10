import { Boxes, Cpu, Gauge, ListChecks, Plug, Sparkles, Workflow } from "lucide-react";
import { useList } from "@refinedev/core";
import { useRouterState } from "@tanstack/react-router";
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
  const { result: operations } = useList({
    queryOptions: { retry: false },
    resource: ResourceName.operations,
  });
  const { result: jobs } = useList({
    queryOptions: { retry: false },
    resource: ResourceName.jobs,
  });
  const activeKey = getActiveKey(location.pathname);
  const normalizedQuery = sidebarSearchQuery.trim().toLowerCase();

  const groups: NavigationGroup[] = [
    {
      title: "Assembly",
      items: [
        {
          badge: getTotalLabel(pipelines?.total),
          icon: Workflow,
          key: "pipelines",
          label: "Pipelines",
          to: "/pipelines",
        },
        {
          badge: getTotalLabel(operations?.total),
          icon: Boxes,
          key: "components",
          label: "Components",
          to: "/components",
        },
      ],
    },
    {
      title: "Monitor",
      items: [
        {
          badge: getTotalLabel(jobs?.total),
          icon: ListChecks,
          key: "jobs",
          label: "Jobs",
          to: "/jobs",
        },
        {
          icon: Gauge,
          key: "usage",
          label: "Usage",
          to: "/usage",
        },
      ],
    },
    {
      collapsible: true,
      title: "Capabilities",
      items: [
        {
          icon: Cpu,
          key: "agents",
          label: "Local Agents",
          to: "/local-agents",
        },
        {
          icon: Sparkles,
          key: "skills",
          label: "Skills",
          to: "/skills",
        },
        {
          icon: Plug,
          key: "connectors",
          label: "Connectors",
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
