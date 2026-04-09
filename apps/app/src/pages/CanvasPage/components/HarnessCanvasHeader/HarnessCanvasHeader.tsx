import { useState } from "react";
import { Settings, Save, CheckCircle2, Loader2 } from "lucide-react";
import { useStore } from "zustand";
import { useTranslation } from "react-i18next";
import { Button } from "@repo/ui/button";
import { Separator } from "@repo/ui/separator";
import { useHarnessCanvasStore } from "../../_store";
import { updatePipeline } from "@/services/pipelinesService";
import { ResultAsync } from "neverthrow";

const handleNavigateSettings = () => void (globalThis.location.href = "/settings");

export const HarnessCanvasHeader = () => {
  const { t } = useTranslation();
  const store = useHarnessCanvasStore();
  const pipelineId = useStore(store, (s) => s.pipelineId);
  const pipelineName = useStore(store, (s) => s.pipelineName);
  const nodes = useStore(store, (s) => s.nodes);
  const edges = useStore(store, (s) => s.edges);

  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");

  const handleSave = async () => {
    if (!pipelineId) return;
    setSaveState("saving");
    const result = await ResultAsync.fromPromise(
      updatePipeline({
        data: {
          id: pipelineId,
          patch: {
            name: pipelineName || "无标题 Pipeline",
            nodes: nodes as unknown[],
            edges: edges as unknown[],
            updatedAt: Date.now(),
          },
        },
      }),
      () => "save-failed" as const
    );
    result.match(
      () => {
        setSaveState("saved");
        setTimeout(() => setSaveState("idle"), 2000);
      },
      () => setSaveState("idle")
    );
  };

  const handleClickSave = () => void handleSave();

  return (
    <header className="flex h-11 shrink-0 items-center justify-between border-b bg-background px-4">
      <div className="flex items-center gap-2.5">
        <div className="flex items-center gap-1">
          <span className="text-sm font-semibold">{t("canvas.title")}</span>
          <span className="text-muted-foreground">/</span>
          <span className="text-sm text-muted-foreground">
            {pipelineName || t("canvas.unsavedPipeline")}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1">
        {pipelineId && (
          <Button
            className="h-7 gap-1.5 px-2.5 text-xs"
            disabled={saveState === "saving"}
            size="sm"
            variant="ghost"
            onClick={handleClickSave}
          >
            {saveState === "saving" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : saveState === "saved" ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            {saveState === "saved" ? t("canvas.saveSuccess") : t("common.save")}
          </Button>
        )}
        <Separator className="mx-1 h-4" orientation="vertical" />
        <Button
          className="h-7 w-7"
          size="icon"
          title={t("nav.settings")}
          variant="ghost"
          onClick={handleNavigateSettings}
        >
          <Settings className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
};
