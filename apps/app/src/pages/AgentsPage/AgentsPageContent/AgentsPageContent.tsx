import { useStore } from "zustand";
import { Search, Bot, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { Badge } from "@repo/ui/badge";
import type { Agent } from "@repo/schemas";
import { useList } from "@refinedev/core";
import { ResourceName } from "@/integrations/refine/dataProvider";
import { PageLoadingState } from "@/components/PageLoadingState";
import { PageHeader } from "@/components/PageHeader";
import { useAgentsPageStore } from "../_store";
import { AgentFormDialog } from "../AgentFormDialog";

export const AgentsPageContent = () => {
  const { result: agentsResult, query: agentsQuery } = useList<Agent>({
    resource: ResourceName.agents,
  });
  const agents = agentsResult?.data ?? ([] as Agent[]);
  const { t } = useTranslation();

  const store = useAgentsPageStore();
  const search = useStore(store, (s) => s.search);
  const showForm = useStore(store, (s) => s.showForm);
  const editing = useStore(store, (s) => s.editing);
  const handleSetSearch = useStore(store, (s) => s.handleSetSearch);
  const handleSetShowForm = useStore(store, (s) => s.handleSetShowForm);
  const handleSetEditing = useStore(store, (s) => s.handleSetEditing);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    handleSetSearch(e.target.value);

  const handleAddAgent = () => {
    handleSetEditing(null);
    handleSetShowForm(true);
  };

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
          <Button size="sm" onClick={handleAddAgent}>
            <Plus className="h-4 w-4" />
            {t("agents.create")}
          </Button>
        }
        icon={<Bot className="h-4 w-4 text-primary" />}
        title={t("agents.title")}
      />

      {showForm && <AgentFormDialog initial={editing ?? undefined} />}

      <div className="flex items-center gap-3 border-b border-border bg-background px-6 py-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-8 pl-8 text-sm"
            placeholder={t("agents.searchPlaceholder")}
            value={search}
            onChange={handleSearchChange}
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((agent) => (
              <div
                key={agent.id}
                className="rounded-lg border border-border bg-card p-4 shadow-sm transition-colors hover:border-primary/30"
              >
                <div className="mb-2 flex items-start justify-between">
                  <h3 className="text-sm font-semibold text-foreground">{agent.name}</h3>
                  {agent.defaultRuntime && (
                    <Badge className="text-[10px]" variant="outline">
                      {agent.defaultRuntime}
                    </Badge>
                  )}
                </div>

                {agent.description && (
                  <p className="mb-3 text-xs text-muted-foreground line-clamp-2">
                    {agent.description}
                  </p>
                )}

                {agent.capabilities.length > 0 && (
                  <div className="mb-2">
                    <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      {t("agents.capabilities")}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {agent.capabilities.map((cap) => (
                        <Badge key={cap.name} className="text-[10px]" variant="secondary">
                          {cap.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {agent.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {agent.tags.map((tag) => (
                      <Badge key={tag} className="text-[10px]" variant="outline">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
