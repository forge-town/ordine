import { Bot, Loader2, Play, Save, Settings2, Workflow } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { CSSProperties } from "react";
import { useStore } from "zustand";
import { cn } from "@repo/ui/lib/utils";
import {
  AgentExecutionPicker,
  useAgentExecutionChoice,
} from "../../../components/AgentExecutionPicker";
import { useCanvasPageStore } from "../_store";
import { CanvasStatusBar } from "../CanvasStatusBar";
import { useCanvasWorkspacePersistence } from "../useCanvasWorkspacePersistence";

export const CanvasTopChrome = () => {
  const { t } = useTranslation();
  const store = useCanvasPageStore();
  const pipelineId = useStore(store, (state) => state.pipelineId);
  const pipelineName = useStore(store, (state) => state.pipelineName);
  const isRunning = useStore(store, (state) => state.isRunning);
  const isTestRunning = useStore(store, (state) => state.isTestRunning);
  const agentPanelIsOpen = useStore(store, (state) => state.agentPanel.isOpen);
  const agentPanelWidth = useStore(store, (state) => state.agentPanelWidth);
  const handleOpenCanvasSettings = useStore(store, (state) => state.openCanvasSettings);
  const handlePipelineNameChange = useStore(store, (state) => state.handlePipelineNameChange);
  const handleRunTest = useStore(store, (state) => state.handleRunTest);
  const toggleAgentPanel = useStore(store, (state) => state.toggleAgentPanel);
  const {
    catalog,
    choice: executionChoice,
    isLoading: isExecutionChoiceLoading,
    persistChoice,
    selectRuntime,
  } = useAgentExecutionChoice();
  const { handleSave: handleSaveCanvas, isPending: isSavePending } =
    useCanvasWorkspacePersistence();

  const hasAvailableRuntime = executionChoice !== null;
  const isRunPending = isRunning || isTestRunning;
  const canRun = Boolean(pipelineId && hasAvailableRuntime && !isRunPending);
  const pipelineTitleLabel = t("canvas.pipelineTitle", { defaultValue: "Pipeline name" });
  const saveLabel = t("canvas.floatingMenu.save", { defaultValue: "Save" });
  const settingsLabel = t("canvas.settingsDrawer.menuLabel", { defaultValue: "Settings" });
  const runLabel = t("canvas.run", { defaultValue: "Run" });
  const runningLabel = t("canvas.running", { defaultValue: "Running" });
  const agentLabel = t("canvas.agent", { defaultValue: "Agent" });

  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 p-3 min-[1181px]:pr-[calc(var(--canvas-agent-offset)+0.75rem)] max-[480px]:gap-1 max-[480px]:p-2 max-[480px]:pl-12"
      data-canvas-v2-top-pill="true"
      data-testid="canvas-top-chrome"
      style={
        {
          "--canvas-agent-offset": agentPanelIsOpen ? `${agentPanelWidth}px` : "0px",
        } as CSSProperties
      }
    >
      <div className="pointer-events-auto flex min-w-0 items-center gap-2 max-[480px]:gap-1">
        <div
          className="min-w-0 max-w-64 flex-1 max-[480px]:max-w-[7.5rem]"
          data-testid="canvas-title-desktop"
        >
          <div
            className="flex min-w-0 items-center gap-1 rounded-full bg-surface px-2.5 py-1.5 shadow-pill ring-1 ring-border max-[480px]:gap-0.5 max-[480px]:px-2 max-[480px]:py-1"
            data-testid="canvas-top-left-pill"
          >
            <Workflow className="size-3.5 shrink-0 text-muted-foreground" />
            <input
              aria-label={pipelineTitleLabel}
              className="min-w-0 flex-1 truncate bg-transparent px-1 py-0.5 text-xs font-semibold text-foreground outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-border-strong max-[480px]:w-16"
              name="pipelineName"
              placeholder={t("canvas.pipelineTitlePlaceholder", { defaultValue: "Pipeline name" })}
              value={pipelineName}
              onChange={handlePipelineNameChange}
            />
            <div className="flex shrink-0 items-center gap-0.5">
              <button
                aria-label={saveLabel}
                className="flex size-7 items-center justify-center rounded-full p-0 text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border-strong disabled:opacity-70"
                data-testid="canvas-v2-save"
                disabled={isSavePending}
                type="button"
                onClick={handleSaveCanvas}
              >
                <Save className="size-3.5" />
              </button>
              <button
                aria-label={settingsLabel}
                className="flex size-7 items-center justify-center rounded-full p-0 text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border-strong"
                data-testid="canvas-v2-settings"
                type="button"
                onClick={handleOpenCanvasSettings}
              >
                <Settings2 className="size-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="pointer-events-auto flex shrink-0 items-center gap-2 max-[480px]:gap-1">
        <CanvasStatusBar />
        <div data-testid="canvas-v2-execution-picker">
          <AgentExecutionPicker
            catalog={catalog}
            choice={executionChoice}
            disabled={isRunPending}
            isLoading={isExecutionChoiceLoading}
            triggerVariant="button"
            onChange={persistChoice}
            onRuntimeChange={selectRuntime}
          />
        </div>
        <button
          aria-label={isRunPending ? runningLabel : runLabel}
          className={cn(
            "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium shadow-pill transition-all disabled:opacity-70 max-[480px]:px-2",
            canRun
              ? "bg-foreground text-background hover:opacity-90"
              : "cursor-not-allowed bg-surface text-muted-foreground ring-1 ring-border",
          )}
          data-testid="canvas-v2-run"
          disabled={!canRun}
          type="button"
          onClick={() => void handleRunTest(executionChoice)}
        >
          {isRunPending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Play className="size-3.5 fill-current" />
          )}
          <span className="max-[480px]:sr-only">{isRunPending ? runningLabel : runLabel}</span>
        </button>
        {!agentPanelIsOpen ? (
          <button
            aria-label={agentLabel}
            className="flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-xs text-foreground shadow-pill ring-1 ring-border transition-colors hover:ring-border-strong max-[480px]:px-2"
            data-testid="canvas-v2-agent-reopen"
            type="button"
            onClick={toggleAgentPanel}
          >
            <Bot className="size-3.5" />
            {agentLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
};
