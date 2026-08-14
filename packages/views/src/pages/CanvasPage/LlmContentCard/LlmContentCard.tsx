import { X, Brain, Activity } from "lucide-react";
import Markdown from "react-markdown";
import { useTranslation } from "react-i18next";
import { Button } from "@repo/ui/button";
import { ScrollArea } from "@repo/ui/scroll-area";
import { useStore } from "zustand";
import { useCanvasPageStore } from "../_store";

export const LlmContentCard = () => {
  const { t } = useTranslation();
  const store = useCanvasPageStore();
  const inspectingNodeId = useStore(store, (s) => s.inspectingNodeId);
  const handleDismissInspection = useStore(store, (s) => s.handleDismissInspection);
  const nodeLlmContent = useStore(store, (s) => s.nodeLlmContent);
  const nodeRunStatuses = useStore(store, (s) => s.nodeRunStatuses);
  const nodes = useStore(store, (s) => s.nodes);

  if (!inspectingNodeId) return null;

  const content = nodeLlmContent[inspectingNodeId];
  const status = nodeRunStatuses[inspectingNodeId];
  const node = nodes.find((n) => n.id === inspectingNodeId);
  const nodeLabel = (node?.data as Record<string, unknown>)?.label as string | undefined;

  return (
    <aside
      aria-label={t("canvas.llmContent.title", { label: nodeLabel ?? "LLM" })}
      className="absolute right-4 top-14 z-40 flex w-[480px] max-w-[calc(100vw-2rem)] flex-col rounded-lg bg-surface shadow-float ring-1 ring-border"
    >
      <div className="flex shrink-0 items-center justify-between border-b px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-violet-500" />
          <span className="text-sm font-semibold truncate">
            {t("canvas.llmContent.title", { label: nodeLabel ?? "LLM" })}
          </span>
          {status === "running" && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:text-blue-300">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-blue-400 opacity-50 motion-reduce:animate-none" />
                <span className="relative inline-flex size-1.5 rounded-full bg-blue-500" />
              </span>
              {t("canvas.llmContent.statusRunning")}
            </span>
          )}
        </div>
        <Button
          aria-label={t("canvas.llmContent.close")}
          className="h-6 w-6 shrink-0"
          size="icon"
          variant="ghost"
          onClick={handleDismissInspection}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      <ScrollArea className="max-h-[60vh] min-h-0">
        <div className="overflow-hidden p-4">
          {status === "running" && !content && (
            <div
              aria-live="polite"
              className="rounded-lg bg-surface-2 p-4 ring-1 ring-border/80"
              role="status"
            >
              <div className="flex items-start gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-blue-500/10 text-blue-700 dark:text-blue-300">
                  <Activity className="size-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    {t("canvas.llmContent.running")}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {t("canvas.llmContent.runningDescription")}
                  </p>
                </div>
              </div>
            </div>
          )}
          {content ? (
            <div className="prose prose-sm max-w-none overflow-hidden break-words text-xs leading-relaxed dark:prose-invert [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:bg-surface-2 [&_pre]:p-2 [&_pre]:text-[10px] [&_code]:rounded [&_code]:bg-surface-2 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[10px] [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-xs [&_li]:my-0.5 [&_ol]:my-1.5 [&_p]:my-1.5 [&_ul]:my-1.5">
              <Markdown>{content}</Markdown>
            </div>
          ) : (
            status !== "running" && (
              <p className="text-sm text-muted-foreground">{t("canvas.llmContent.empty")}</p>
            )
          )}
        </div>
      </ScrollArea>
    </aside>
  );
};
