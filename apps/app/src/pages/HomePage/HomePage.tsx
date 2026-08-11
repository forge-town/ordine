import { useList } from "@refinedev/core";
import { Bot, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import type { AgentRuntimeConfig } from "@repo/schemas";
import { Link } from "@tanstack/react-router";
import { PipelineCreationWorkspace } from "@/components/PipelineCreationWorkspace";
import { useSidebarStore } from "@/store/sidebarStore";

export const HomePage = () => {
  const { t } = useTranslation();
  const sidebarStore = useSidebarStore();
  const workspaceVersion = useStore(sidebarStore, (state) => state.newPipelineWorkspaceVersion);
  const { result, query } = useList<AgentRuntimeConfig>({
    resource: "agentRuntimes",
  });
  const localRuntimes = result.data.filter((runtime) => runtime.connection.mode === "local");
  const runtime = localRuntimes.find((candidate) => candidate.type === "codex") ?? localRuntimes[0];
  const runtimeLabel = query.isLoading
    ? t("home.checkingAgent")
    : runtime
      ? localRuntimes.length > 1
        ? t("home.localAgentCount", { name: runtime.name, count: localRuntimes.length - 1 })
        : runtime.name
      : undefined;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border/80 px-4 sm:px-6">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold tracking-[-0.015em]">{t("home.title")}</p>
          <p className="truncate text-[11px] text-muted-foreground">{t("home.subtitle")}</p>
        </div>
        <Link
          className="inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
          to="/local-agents"
        >
          <Bot className="size-3.5" />
          <span className="hidden sm:inline">
            {runtime ? t("home.agentReady") : t("home.connectLocalAgent")}
          </span>
          <ChevronRight className="size-3.5" />
        </Link>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex min-h-full w-full max-w-[860px] flex-col justify-center px-4 py-10 sm:px-8 sm:py-14">
          <div className="mb-6 text-center">
            <p className="mb-2 text-xs font-medium text-muted-foreground">{t("home.eyebrow")}</p>
            <h1 className="text-balance text-2xl font-semibold tracking-[-0.035em] text-foreground sm:text-[30px]">
              {t("home.heading")}
            </h1>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
              {t("home.description")}
            </p>
          </div>

          <PipelineCreationWorkspace
            key={workspaceVersion}
            active
            presentation="home"
            runtimeConnected={Boolean(runtime)}
            runtimeId={runtime?.id}
            runtimeLabel={runtimeLabel}
          />
        </div>
      </main>
    </div>
  );
};
