import { X, Brain, Loader2 } from "lucide-react";
import Markdown from "react-markdown";
import { useTranslation } from "react-i18next";
import { Button } from "@repo/ui/button";
import { ScrollArea } from "@repo/ui/scroll-area";
import { useStore } from "zustand";
import { useHarnessCanvasStore } from "../_store";

export const LlmContentCard = () => {
  const { t } = useTranslation();
  const store = useHarnessCanvasStore();
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
    <div className="absolute right-4 top-14 z-40 flex w-[480px] max-w-[calc(100vw-2rem)] flex-col rounded-xl border bg-background shadow-2xl">
      <div className="flex shrink-0 items-center justify-between border-b px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-violet-500" />
          <span className="text-sm font-semibold truncate">
            {t("canvas.llmContent.title", { label: nodeLabel ?? "LLM" })}
          </span>
          {status === "running" && <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />}
        </div>
        <Button
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
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{t("canvas.llmContent.running")}</span>
            </div>
          )}
          {content ? (
            <div className="prose prose-sm prose-slate max-w-none overflow-hidden break-words text-xs leading-relaxed [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:bg-slate-100 [&_pre]:p-2 [&_pre]:text-[10px] [&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[10px] [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-xs [&_p]:my-1.5 [&_ul]:my-1.5 [&_ol]:my-1.5 [&_li]:my-0.5">
              <Markdown>{content}</Markdown>
            </div>
          ) : (
            status !== "running" && (
              <p className="text-sm text-muted-foreground">{t("canvas.llmContent.empty")}</p>
            )
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
