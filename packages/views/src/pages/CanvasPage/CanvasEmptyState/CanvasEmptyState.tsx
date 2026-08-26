import { Plus, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { Button } from "@repo/ui/button";
import { cn } from "@repo/ui/lib/utils";
import { useCanvasPageStore } from "../_store";

export const CanvasEmptyState = () => {
  const { t } = useTranslation();
  const store = useCanvasPageStore();
  const handleOpenQuickAdd = useStore(store, (state) => state.handleOpenQuickAdd);
  const isComponentPanelOpen = useStore(
    store,
    (state) => state.isSidebarOpen && state.sidebarPanel === "components",
  );

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 z-[1] grid place-items-center px-6",
        isComponentPanelOpen && "min-[1181px]:pl-[246px]",
      )}
      data-testid="canvas-v2-empty-state"
    >
      <div className="pointer-events-auto flex w-[min(28rem,100%)] flex-col items-center text-center">
        <div className="mb-4 flex size-11 items-center justify-center rounded-lg bg-foreground text-background shadow-soft">
          <Sparkles className="size-5" />
        </div>
        <h2 className="text-base font-semibold text-foreground">{t("canvas.emptyState.title")}</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {t("canvas.emptyState.description")}
        </p>
        <Button className="mt-5" size="sm" type="button" onClick={handleOpenQuickAdd}>
          <Plus className="size-3.5" />
          {t("canvas.emptyState.quickAdd")}
        </Button>
      </div>
    </div>
  );
};
