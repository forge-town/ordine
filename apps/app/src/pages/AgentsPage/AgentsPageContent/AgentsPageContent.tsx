import { useStore } from "zustand";
import { Search, Bot, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import type { Agent } from "@repo/schemas";
import { useList } from "@refinedev/core";
import { ResourceName } from "@/integrations/refine/dataProvider";
import { PageLoadingState } from "@/components/PageLoadingState";
import { PageHeader } from "@/components/PageHeader";
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
        <PageHeader title={t("agents.title")} />
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
        icon={<Bot className="h-4 w-4 text-primary" />}
        title={t("agents.title")}
      />

      {showForm && <AgentFormDialog />}

      <div className="flex items-center gap-3 border-b border-border bg-background px-6 py-3">
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

      <div className="flex-1 overflow-auto p-6">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Bot className="mb-3 h-10 w-10 opacity-40" />
            <p className="text-sm">{t("agents.noAgents")}</p>
          </div>
        ) : (
          <AgentsDataTable data={filtered} />
        )}
      </div>
    </div>
  );
};
