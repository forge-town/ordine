import { useStore } from "zustand";
import { Search, Bot, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import type { Agent } from "@repo/schemas";
import { useList } from "@refinedev/core";
import { ResourceName } from "../../../constants";
import { PageLoadingState } from "../../../components/PageLoadingState";
import { PageHeader } from "../../../components/PageHeader";
import { PageState } from "../../../components/PageState";
import { useAgentsPageStore } from "../_store";
import { AgentFormDialog } from "../AgentFormDialog";
import { AgentsDataTable } from "../AgentsDataTable";

export const AgentsPageContent = () => {
  const { result: agentsResult, query: agentsQuery } = useList<Agent>({
    resource: ResourceName.agents,
  });
  const agents = agentsResult.data;
  const { t } = useTranslation();

  const store = useAgentsPageStore();
  const search = useStore(store, (s) => s.search);
  const showForm = useStore(store, (s) => s.showForm);
  const handleSearchInputChange = useStore(store, (s) => s.handleSearchInputChange);
  const handleAddAgentButtonClick = useStore(store, (s) => s.handleAddAgentButtonClick);

  const filtered = agents.filter((a: Agent) => {
    const matchesSearch =
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      (a.description ?? "").toLowerCase().includes(search.toLowerCase());

    return matchesSearch;
  });

  if (agentsQuery?.isLoading) {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        <PageHeader
          eyebrow={t("nav.groups.capabilities")}
          icon={<Bot className="h-4 w-4 text-primary" />}
          sub={t("agents.subtitle")}
          title={t("agents.title")}
        />
        <PageLoadingState variant="grid" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        actions={
          <Button size="sm" onClick={handleAddAgentButtonClick}>
            <Plus className="h-4 w-4" />
            {t("agents.create")}
          </Button>
        }
        badge={
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {filtered.length}
          </span>
        }
        eyebrow={t("nav.groups.capabilities")}
        icon={<Bot className="h-4 w-4 text-primary" />}
        sub={t("agents.subtitle")}
        title={t("agents.title")}
      />

      {showForm && <AgentFormDialog />}

      <div className="flex items-center gap-3 border-b border-border bg-background px-4 py-3 sm:px-7">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-8 pl-8 text-sm"
            placeholder={t("agents.searchPlaceholder")}
            value={search}
            onChange={handleSearchInputChange}
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8 pt-4 sm:px-7">
        {filtered.length === 0 ? (
          <PageState icon={<Bot />} title={t("agents.noAgents")} />
        ) : (
          <AgentsDataTable data={filtered} />
        )}
      </div>
    </div>
  );
};
