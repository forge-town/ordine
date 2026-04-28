import { MousePointer2, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { Button } from "@repo/ui/button";
import { useHarnessCanvasStore } from "../_store";

export const CanvasEmptyState = () => {
  const { t } = useTranslation();
  const store = useHarnessCanvasStore();
  const openQuickAdd = useStore(store, (state) => state.openQuickAdd);
  const handleOpenQuickAdd = () => openQuickAdd();

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center px-4">
      <div className="pointer-events-auto w-[min(24rem,100%)] rounded-lg border border-dashed border-border bg-background/90 px-5 py-5 text-center shadow-sm backdrop-blur-sm">
        <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Plus className="size-5" />
        </div>
        <h2 className="text-sm font-semibold text-foreground">{t("canvas.emptyState.title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("canvas.emptyState.description")}</p>
        <Button className="mt-4" size="sm" onClick={handleOpenQuickAdd}>
          <Plus className="size-3.5" />
          {t("canvas.emptyState.quickAdd")}
        </Button>
        <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <MousePointer2 className="size-3.5" />
          <span>{t("canvas.emptyState.contextHint")}</span>
        </div>
      </div>
    </div>
  );
};
