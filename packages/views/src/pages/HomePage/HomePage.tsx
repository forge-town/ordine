import { AlertTriangle, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@repo/ui/button";
import { useAgentExecutionChoice } from "../../components/AgentExecutionPicker";
import { PipelineCreationWorkspace } from "../../components/PipelineCreationWorkspace";
import { useSidebarStore } from "../../store/sidebarStore";

export const HomePage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const sidebarStore = useSidebarStore();
  const workspaceVersion = useStore(sidebarStore, (state) => state.newPipelineWorkspaceVersion);
  const {
    catalog,
    catalogQuery,
    choice,
    isLoading,
    persistChoice: handleExecutionChoiceChange,
    selectRuntime: handleExecutionRuntimeChange,
  } = useAgentExecutionChoice();
  const runtimeLabel = isLoading
    ? t("home.checkingAgent")
    : catalogQuery.isError
      ? t("home.agentQueryFailed")
      : (catalog.find((candidate) => candidate.runtimeConfigId === choice?.runtimeConfigId)
          ?.displayName ?? undefined);
  const handleRuntimeRetry = () => void catalogQuery.refetch();
  const handleOpenRuntimeSettings = () => {
    void navigate({ to: "/runtimes" });
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex min-h-full w-full max-w-[860px] flex-col justify-center px-4 py-10 sm:px-8 sm:py-14">
          <div className="mb-10 text-center">
            <h1 className="text-balance font-heading text-4xl font-semibold leading-[1.07] tracking-[-0.015em] sm:text-[56px]">
              {t("home.heading")}
            </h1>
            <p className="mx-auto mt-5 max-w-[520px] text-pretty text-base font-medium leading-[1.38] text-muted-foreground">
              {t("home.description")}
            </p>
          </div>

          {catalogQuery.isError ? (
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
            executionCatalog={catalog}
            executionChoice={choice}
            executionLoading={isLoading}
            presentation="home"
            runtimeConfigured={isLoading ? undefined : Boolean(choice)}
            runtimeId={choice?.runtimeConfigId}
            runtimeLabel={runtimeLabel}
            onExecutionChoiceChange={handleExecutionChoiceChange}
            onExecutionRuntimeChange={handleExecutionRuntimeChange}
            onOpenRuntimeSettings={handleOpenRuntimeSettings}
          />
        </div>
      </main>
    </div>
  );
};
