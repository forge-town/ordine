import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { Input } from "@repo/ui/input";
import { CanvasToolbar } from "../CanvasToolbar";
import { useCanvasPageStore } from "../_store";

export const CanvasTopChrome = () => {
  const { t } = useTranslation();
  const store = useCanvasPageStore();
  const pipelineName = useStore(store, (state) => state.pipelineName);
  const handlePipelineNameChange = useStore(store, (state) => state.handlePipelineNameChange);

  return (
    <div
      className="flex min-h-16 items-center gap-3 border-b bg-background/95 px-3 py-3 backdrop-blur"
      data-testid="canvas-top-chrome"
    >
      <div className="min-w-0 flex-1" data-testid="canvas-title-desktop">
        <div className="flex h-10 w-full min-w-0 items-center rounded-md border bg-background px-3 shadow-sm">
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

      <div className="min-w-0 max-w-full overflow-x-auto [scrollbar-width:none]">
        <CanvasToolbar />
      </div>
    </div>
  );
};
