import { useState } from "react";
import { Settings, Save, CheckCircle2, Loader2 } from "lucide-react";
import { useStore } from "zustand";
import { Button } from "@repo/ui/button";
import { Separator } from "@repo/ui/separator";
import { useHarnessCanvasStore } from "../_store";
import { updatePipeline } from "@/services/pipelinesService";

const handleNavigateSettings = () =>
  void (globalThis.location.href = "/settings");

export const HarnessCanvasHeader = () => {
  const store = useHarnessCanvasStore();
  const pipelineId = useStore(store, (s) => s.pipelineId);
  const pipelineName = useStore(store, (s) => s.pipelineName);
  const nodes = useStore(store, (s) => s.nodes);
  const edges = useStore(store, (s) => s.edges);

  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">(
    "idle",
  );

  const handleSave = async () => {
    if (!pipelineId) return;
    setSaveState("saving");
    try {
      await updatePipeline({
        data: {
          id: pipelineId,
          patch: {
            nodes: nodes as unknown[],
            edges: edges as unknown[],
            updatedAt: Date.now(),
          },
        },
      });
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2000);
    } catch {
      setSaveState("idle");
    }
  };

  const handleClickSave = () => void handleSave();

  return (
    <header className="flex h-11 shrink-0 items-center justify-between border-b bg-background px-4">
      <div className="flex items-center gap-2.5">
        <div className="flex items-center gap-1">
          <span className="text-sm font-semibold">Canvas</span>
          <span className="text-muted-foreground">/</span>
          <span className="text-sm text-muted-foreground">
            {pipelineName || "无标题 Pipeline"}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1">
        {pipelineId && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 px-2.5 text-xs"
            onClick={handleClickSave}
            disabled={saveState === "saving"}
          >
            {saveState === "saving" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : saveState === "saved" ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            {saveState === "saved" ? "已保存" : "保存"}
          </Button>
        )}
        <Separator orientation="vertical" className="mx-1 h-4" />
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={handleNavigateSettings}
          title="设置"
        >
          <Settings className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
};
