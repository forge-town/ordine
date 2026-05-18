import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { Input } from "@repo/ui/input";
import { CanvasFloatingMenu } from "../CanvasFloatingMenu";
import { CanvasToolbar } from "../CanvasToolbar";
import { useHarnessCanvasStore } from "../_store";

export const CanvasTopChrome = () => {
  const { t } = useTranslation();
  const store = useHarnessCanvasStore();
  const pipelineName = useStore(store, (state) => state.pipelineName);
  const handlePipelineNameChange = useStore(store, (state) => state.handlePipelineNameChange);

  const renderPipelineTitle = (className: string, testId: string) => (
    <div className={className} data-testid={testId}>
      <div className="pointer-events-auto flex h-10 w-full min-w-0 items-center rounded-full border border-gray-200 bg-white/90 px-3 shadow-sm backdrop-blur-sm">
        <Input
          aria-label={t("canvas.pipelineTitle")}
          className="h-7 min-w-0 w-full border-none bg-transparent text-sm font-medium text-gray-700 shadow-none outline-none placeholder:text-gray-400"
          name="pipelineName"
          placeholder={t("canvas.pipelineTitlePlaceholder")}
          value={pipelineName}
          onChange={(e) => handlePipelineNameChange(e.target.value)}
        />
      </div>
    </div>
  );

  return (
    <div
      className="pointer-events-none absolute inset-x-3 top-3 z-50 sm:inset-x-4"
      data-testid="canvas-top-chrome"
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-2 max-[420px]:grid-cols-1 min-[700px]:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] min-[700px]:gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <CanvasFloatingMenu />
          {renderPipelineTitle(
            "hidden min-w-0 min-[700px]:flex min-[700px]:w-[clamp(10rem,calc(50vw-17rem),18rem)]",
            "canvas-title-desktop",
          )}
        </div>

        <div className="pointer-events-auto max-w-full justify-self-end overflow-x-auto max-[420px]:justify-self-start max-[420px]:[scrollbar-width:none] min-[700px]:justify-self-center">
          <CanvasToolbar />
        </div>

        <div className="hidden min-[700px]:block" />
      </div>

      {renderPipelineTitle("mt-2 flex w-full min-w-0 min-[700px]:hidden", "canvas-title-narrow")}
    </div>
  );
};
