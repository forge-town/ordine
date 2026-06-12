import { Plus, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@repo/ui/button";
import { useCanvasStore } from "./_store/canvasStore";

export const CanvasEmptyState = () => {
  const { t } = useTranslation();
  const nodeCount = useCanvasStore((state) => state.nodes.length);
  const previewNodeCount = useCanvasStore((state) => state.proposalPreview?.nodes.length ?? 0);
  const addNodeFromCatalog = useCanvasStore((state) => state.addNodeFromCatalog);
  const handleSeed = () => {
    addNodeFromCatalog({
      label: t("workspace.canvas.empty.seedLabel"),
      position: { x: 0, y: 0 },
      type: "prompt",
    });
  };

  // Ghost preview nodes count as content — keep the empty state out of their way.
  if (nodeCount > 0 || previewNodeCount > 0) {
    return null;
  }

  return (
    <div
      className="pointer-events-none absolute inset-0 z-10 grid place-items-center px-6"
      data-testid="canvas-v2-empty-state"
    >
      <div className="pointer-events-auto flex w-[min(28rem,100%)] flex-col items-center text-center">
        <div className="mb-4 flex size-11 items-center justify-center rounded-lg bg-foreground text-background shadow-soft">
          <Sparkles className="size-5" />
        </div>
        <h2 className="text-base font-semibold text-foreground">
          {t("workspace.canvas.empty.title")}
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {t("workspace.canvas.empty.description")}
        </p>
        {import.meta.env.DEV ? (
          <Button
            className="mt-5"
            data-testid="canvas-v2-empty-seed"
            size="sm"
            type="button"
            onClick={handleSeed}
          >
            <Plus className="size-3.5" />
            {t("workspace.canvas.empty.seed")}
          </Button>
        ) : null}
      </div>
    </div>
  );
};
