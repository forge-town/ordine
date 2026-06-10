import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { ChevronRight } from "lucide-react";
import { Input } from "@repo/ui/input";
import { Button } from "@repo/ui/button";
import { CanvasToolbar } from "../CanvasToolbar";
import { useCanvasPageStore } from "../_store";
import { useDrillStack } from "../drill";

export const CanvasTopChrome = () => {
  const { t } = useTranslation();
  const store = useCanvasPageStore();
  const pipelineName = useStore(store, (state) => state.pipelineName);
  const handlePipelineNameChange = useStore(store, (state) => state.handlePipelineNameChange);
  const { breadcrumbs, exitToDepth } = useDrillStack();

  const handleRootBreadcrumbClick = () => {
    exitToDepth(0);
  };

  return (
    <div
      className="flex min-h-16 min-w-0 items-center gap-3 border-b bg-background/95 px-3 py-3 backdrop-blur"
      data-testid="canvas-top-chrome"
    >
      <div className="min-w-0 flex-1 basis-0" data-testid="canvas-title-desktop">
        <div className="flex h-10 w-full min-w-0 items-center rounded-md border bg-background px-3 shadow-sm">
          {breadcrumbs.length > 0 && (
            <div className="mr-2 flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
              <Button
                className="h-6 px-1.5 text-xs"
                type="button"
                variant="ghost"
                onClick={handleRootBreadcrumbClick}
              >
                Root
              </Button>
              {breadcrumbs.map((breadcrumb, index) => {
                const handleBreadcrumbClick = () => {
                  exitToDepth(index + 1);
                };

                return (
                  <div key={breadcrumb.id} className="flex items-center gap-1">
                    <ChevronRight className="h-3 w-3" />
                    <Button
                      className="h-6 max-w-28 px-1.5 text-xs"
                      type="button"
                      variant="ghost"
                      onClick={handleBreadcrumbClick}
                    >
                      <span className="truncate">{breadcrumb.label}</span>
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
          <Input
            aria-label={t("canvas.pipelineTitle")}
            className="h-7 min-w-0 w-full border-none bg-transparent px-0 text-sm font-medium text-foreground shadow-none outline-none placeholder:text-muted-foreground focus-visible:ring-0"
            name="pipelineName"
            placeholder={t("canvas.pipelineTitlePlaceholder")}
            value={pipelineName}
            onChange={handlePipelineNameChange}
          />
        </div>
      </div>

      <div className="min-w-0 max-w-full shrink-0 overflow-x-auto [scrollbar-width:none]">
        <CanvasToolbar />
      </div>
    </div>
  );
};
