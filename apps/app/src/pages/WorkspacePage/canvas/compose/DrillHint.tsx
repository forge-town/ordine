import { Layers } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useCanvasStore } from "../_store/canvasStore";

export const DrillHint = () => {
  const { t } = useTranslation();
  const drillStack = useCanvasStore((state) => state.drillStack);

  if (drillStack.length === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 top-14 z-10 flex justify-center">
      <div
        className="pointer-events-auto flex items-center gap-2 rounded-full bg-surface-2/90 px-3 py-1 text-[11px] text-muted-foreground shadow-soft ring-1 ring-border backdrop-blur"
        data-testid="canvas-v2-drill-hint"
      >
        <Layers className="size-3 text-foreground/70" />
        {t("workspace.canvas.compose.drillHint")}
      </div>
    </div>
  );
};
