import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { ChevronRight, Loader2, Play } from "lucide-react";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { useCanvasPageStore } from "../_store";
import { useDrillStack } from "../drill";

export const CanvasTopChrome = () => {
  const { t } = useTranslation();
  const store = useCanvasPageStore();
  const pipelineName = useStore(store, (state) => state.pipelineName);
  const pipelineId = useStore(store, (state) => state.pipelineId);
  const phase = useStore(store, (state) => state.phase);
  const isRunning = useStore(store, (state) => state.isRunning);
  const isTestRunning = useStore(store, (state) => state.isTestRunning);
  const handlePipelineNameChange = useStore(store, (state) => state.handlePipelineNameChange);
  const handleRunTest = useStore(store, (state) => state.handleRunTest);
  const { breadcrumbs, exitToDepth } = useDrillStack();
  const isRunActive = isRunning || isTestRunning || phase === "running";
  const canRun = !!pipelineId && !isRunActive && (phase === "applied" || phase === "done");

  const handleRootBreadcrumbClick = () => {
    exitToDepth(0);
  };

  return (
    <div
      className="relative flex min-h-16 min-w-0 items-center justify-center border-b bg-background/95 px-3 py-3 backdrop-blur"
      data-testid="canvas-top-chrome"
    >
      <div
        className="flex h-10 w-full max-w-[760px] min-w-0 items-center gap-2 rounded-full border border-border bg-background px-2.5 shadow-soft"
        data-testid="canvas-title-desktop"
      >
        {breadcrumbs.length > 0 && (
          <div className="flex min-w-0 shrink-0 items-center gap-1 text-xs text-muted-foreground">
            <Button
              className="h-6 rounded-full px-2 text-xs"
              type="button"
              variant="ghost"
              onClick={handleRootBreadcrumbClick}
            >
              Root
            </Button>
            {breadcrumbs.map((breadcrumb, index) => {
              const handleBreadcrumbClick = () => {
                exitToDepth(index + 1);
              };

              return (
                <div key={breadcrumb.id} className="flex min-w-0 items-center gap-1">
                  <ChevronRight className="h-3 w-3 shrink-0" />
                  <Button
                    className="h-6 max-w-28 rounded-full px-2 text-xs"
                    type="button"
                    variant="ghost"
                    onClick={handleBreadcrumbClick}
                  >
                    <span className="truncate">{breadcrumb.label}</span>
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        <Input
          aria-label={t("canvas.pipelineTitle")}
          className="h-7 min-w-0 flex-1 border-none bg-transparent px-1 text-center text-sm font-medium text-foreground shadow-none outline-none placeholder:text-muted-foreground focus-visible:ring-0"
          name="pipelineName"
          placeholder={t("canvas.pipelineTitlePlaceholder")}
          value={pipelineName}
          onChange={handlePipelineNameChange}
        />

        <Button
          className="h-7 shrink-0 rounded-full px-3 text-xs"
          disabled={!canRun}
          size="sm"
          type="button"
          variant={canRun ? "default" : "secondary"}
          onClick={handleRunTest}
        >
          {isRunActive ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Play className="h-3.5 w-3.5" />
          )}
          {isRunActive ? t("canvas.runningStatus") : t("canvas.run")}
        </Button>
      </div>
    </div>
  );
};
