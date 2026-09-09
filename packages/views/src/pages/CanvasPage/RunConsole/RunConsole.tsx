import { ChevronDown, ChevronUp, SquareTerminal, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { cn } from "@repo/ui/lib/utils";
import { useCanvasPageStore } from "../_store";
import { ExecutionRequestCard } from "../../../components/ExecutionRequest/ExecutionRequestCard";

export const RunConsole = ({ visible = true }: { visible?: boolean }) => {
  const { t } = useTranslation();
  const store = useCanvasPageStore();
  const submission = useStore(store, (state) => state.executionSubmission);
  const error = useStore(store, (state) => state.executionError);
  const collapsed = useStore(store, (state) => state.isConsoleCollapsed);
  const handleClose = useStore(store, (state) => state.handleCloseConsole);
  const handleToggle = useStore(store, (state) => state.handleToggleConsoleCollapse);
  const handleReceipt = useStore(store, (state) => state.receiveExecutionReceipt);
  const handleJob = useStore(store, (state) => state.receiveExecutionJob);
  const handleEvents = useStore(store, (state) => state.receiveExecutionEvents);

  return (
    <div
      className={cn("pointer-events-auto absolute inset-x-3 bottom-16 z-30", !visible && "hidden")}
      data-testid="canvas-run-console"
      hidden={!visible}
    >
      <div className="overflow-hidden rounded-2xl bg-surface shadow-float ring-1 ring-border-strong">
        <div className="flex w-full items-center gap-2 border-b border-border/70 px-3.5 py-2">
          <button
            className="flex min-w-0 flex-1 items-center gap-2 text-left"
            data-testid="run-console-toggle"
            type="button"
            onClick={handleToggle}
          >
            <span className="flex size-5 items-center justify-center rounded-md bg-surface-2">
              <SquareTerminal className="size-3 text-foreground/75" />
            </span>
            <span className="text-xs font-semibold">{t("canvas.runConsole.title")}</span>
            <span className="ml-auto text-muted-foreground">
              {collapsed ? (
                <ChevronUp className="size-3.5" />
              ) : (
                <ChevronDown className="size-3.5" />
              )}
            </span>
          </button>
          <button
            aria-label={t("common.close")}
            className="rounded-lg p-1 text-muted-foreground hover:bg-accent/60 hover:text-foreground"
            data-testid="run-console-close"
            type="button"
            onClick={handleClose}
          >
            <X className="size-3.5" />
          </button>
        </div>
        <div
          className={cn(
            "max-h-72 overflow-y-auto px-3.5 py-2.5 text-xs leading-relaxed",
            collapsed && "hidden",
          )}
          hidden={collapsed}
        >
          {error && (
            <p className="mb-2 break-words text-destructive" role="alert">
              {error}
            </p>
          )}
          {!submission.request && (
            <p role="status">{error ? "请修正定义后重新运行。" : "正在保存并检查 Pipeline…"}</p>
          )}
          {submission.phase === "submitting" && <p role="status">正在提交运行请求…</p>}
          {submission.request && submission.phase !== "submitting" && (
            <ExecutionRequestCard
              key={submission.request.requestId}
              requestId={submission.request.requestId}
              onEvents={handleEvents}
              onJob={handleJob}
              onReceipt={handleReceipt}
            />
          )}
        </div>
      </div>
    </div>
  );
};
