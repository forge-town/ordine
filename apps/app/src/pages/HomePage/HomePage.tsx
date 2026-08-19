import { useState } from "react";
import { useList } from "@refinedev/core";
import { AlertTriangle, Bot, ChevronRight, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import type { AgentRuntimeConfig } from "@repo/schemas";
import { Link } from "@tanstack/react-router";
import { Button } from "@repo/ui/button";
import { PipelineCreationWorkspace } from "@/components/PipelineCreationWorkspace";
import { useSidebarStore } from "@/store/sidebarStore";

export const HomePage = () => {
  const { t } = useTranslation();
  const [selectedRuntimeId, setSelectedRuntimeId] = useState<string | null>(null);
  const sidebarStore = useSidebarStore();
  const workspaceVersion = useStore(sidebarStore, (state) => state.newPipelineWorkspaceVersion);
  const { result, query } = useList<AgentRuntimeConfig>({
    resource: "agentRuntimes",
  });
  const localRuntimes = result.data.filter((runtime) => runtime.connection.mode === "local");
  const defaultRuntime =
    localRuntimes.find((candidate) => candidate.type === "codex") ?? localRuntimes[0];
  const runtime =
    localRuntimes.find((candidate) => candidate.id === selectedRuntimeId) ?? defaultRuntime;
  const runtimeLabel = query.isLoading
    ? t("home.checkingAgent")
    : query.isError
      ? t("home.agentQueryFailed")
      : runtime
        ? localRuntimes.length > 1
          ? t("home.localAgentCount", { name: runtime.name, count: localRuntimes.length - 1 })
          : runtime.name
        : undefined;
  const handleRuntimeRetry = () => void query.refetch();
  const handleRuntimeValueChange = (runtimeId: string | null) => {
    setSelectedRuntimeId(runtimeId);
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border/80 px-4 sm:px-6">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold tracking-[-0.015em]">{t("home.title")}</p>
          <p className="truncate text-[11px] text-muted-foreground">{t("home.subtitle")}</p>
        </div>
        {runtime ? (
          <Link
            aria-label={t("home.manageLocalAgents")}
            className="flex min-w-0 max-w-[min(45vw,16rem)] items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
            to="/local-agents"
          >
            <span className="size-1.5 shrink-0 rounded-full bg-info" />
            <span className="truncate">{runtimeLabel}</span>
            <ChevronRight className="size-3.5 shrink-0" />
          </Link>
        ) : (
          <Link
            className="inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
            to="/local-agents"
          >
            <Bot className="size-3.5" />
            <span className="hidden sm:inline">
              {query.isError ? t("home.agentQueryFailed") : t("home.connectLocalAgent")}
            </span>
            <ChevronRight className="size-3.5" />
          </Link>
        )}
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex min-h-full w-full max-w-[860px] flex-col justify-center px-4 py-10 sm:px-8 sm:py-14">
          <div className="mb-6 text-center">
            <h1 className="text-balance text-2xl font-semibold tracking-[-0.035em] text-foreground sm:text-[30px]">
              {t("home.heading")}
            </h1>
          </div>

          {query.isError ? (
            <div
              className="mb-3 flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/8 px-3 py-2.5 text-sm"
              role="alert"
            >
              <AlertTriangle className="size-4 shrink-0 text-destructive" />
              <span className="min-w-0 flex-1 break-words text-foreground">
                {t("home.runtimeLoadFailed")}
              </span>
              <Button size="sm" variant="outline" onClick={handleRuntimeRetry}>
                <RefreshCw className="size-3.5" />
                {t("common.retry")}
              </Button>
            </div>
          ) : null}

          <PipelineCreationWorkspace
            key={workspaceVersion}
            active
            presentation="home"
            runtimeConfigured={query.isLoading ? undefined : Boolean(runtime)}
            runtimeId={runtime?.id}
            runtimeLabel={runtimeLabel}
            runtimeOptions={localRuntimes.map(({ id, name }) => ({ id, name }))}
            onRuntimeChange={handleRuntimeValueChange}
          />
        </div>
      </main>
    </div>
  );
};
