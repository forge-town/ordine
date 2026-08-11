import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { Input } from "@repo/ui/input";
import { CanvasToolbar } from "../CanvasToolbar";
import { useCanvasPageStore } from "../_store";

export const CanvasTopChrome = () => {
  const { t } = useTranslation();
  const store = useCanvasPageStore();
  const pipelineName = useStore(store, (state) => state.pipelineName);
  const isSidebarOpen = useStore(store, (state) => state.isSidebarOpen);
  const workspacePanelWidth = useStore(store, (state) => state.workspacePanelWidth);
  const handlePipelineNameChange = useStore(store, (state) => state.handlePipelineNameChange);

  return (
    <div
      className="flex h-14 min-w-0 shrink-0 items-center gap-3 border-b bg-background/95 px-3 py-2 backdrop-blur"
      data-testid="canvas-top-chrome"
    >
      <div
        className="min-w-0 shrink-0 max-[981px]:flex-1 max-[981px]:basis-0"
        data-testid="canvas-title-desktop"
        style={{ width: isSidebarOpen ? `${workspacePanelWidth}px` : "min(18rem, 38%)" }}
      >
        <div className="flex h-10 w-full min-w-0 items-center rounded-md bg-surface px-3 shadow-soft ring-1 ring-border">
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

      <div className="min-w-0 max-w-full flex-1 overflow-x-auto [scrollbar-width:none]">
        <CanvasToolbar />
      </div>
    </div>
  );
};
