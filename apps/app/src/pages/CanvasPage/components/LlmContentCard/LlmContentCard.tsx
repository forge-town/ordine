import { X, Brain, Loader2 } from "lucide-react";
import { Button } from "@repo/ui/button";
import { ScrollArea } from "@repo/ui/scroll-area";
import { cn } from "@repo/ui/lib/utils";
import { useStore } from "zustand";
import { useHarnessCanvasStore } from "../../_store";

export const LlmContentCard = () => {
  const store = useHarnessCanvasStore();
  const inspectingNodeId = useStore(store, (s) => s.inspectingNodeId);
  const setInspectingNodeId = useStore(store, (s) => s.setInspectingNodeId);
  const nodeLlmContent = useStore(store, (s) => s.nodeLlmContent);
  const nodeRunStatuses = useStore(store, (s) => s.nodeRunStatuses);
  const nodes = useStore(store, (s) => s.nodes);

  if (!inspectingNodeId) return null;

  const content = nodeLlmContent[inspectingNodeId];
  const status = nodeRunStatuses[inspectingNodeId];
  const node = nodes.find((n) => n.id === inspectingNodeId);
  const nodeLabel = (node?.data as Record<string, unknown>)?.label as string | undefined;

  const handleClose = () => setInspectingNodeId(null);

  return (
    <div className="absolute right-4 top-14 z-40 w-96 rounded-xl border bg-background shadow-2xl">
      <div className="flex items-center justify-between border-b px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-violet-500" />
          <span className="text-sm font-semibold">{nodeLabel ?? "LLM"} — 思考内容</span>
        </div>
        <Button className="h-6 w-6" size="icon" variant="ghost" onClick={handleClose}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      <ScrollArea className="max-h-80">
        <div className="p-4">
          {status === "running" && !content && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>LLM 正在思考中...</span>
            </div>
          )}
          {content ? (
            <pre
              className={cn(
                "whitespace-pre-wrap text-xs leading-relaxed text-foreground font-mono",
                status === "running" && "animate-pulse"
              )}
            >
              {content}
            </pre>
          ) : (
            status !== "running" && (
              <p className="text-sm text-muted-foreground">暂无 LLM 输出内容</p>
            )
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
