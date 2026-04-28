import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { useHarnessCanvasStore } from "../_store";
import { Input } from "@repo/ui/input";
import { CanvasToolbar } from "../CanvasToolbar";
import { CanvasFlow } from "../CanvasFlow";
import { CanvasContextMenu } from "../CanvasContextMenu";
import { ConnectionMenu } from "../ConnectionMenu";
import { NodeContextMenu } from "../NodeContextMenu";
import { CanvasFloatingMenu } from "../CanvasFloatingMenu";
import { RunConsole } from "../RunConsole";
import { LlmContentCard } from "../LlmContentCard/LlmContentCard";
import { CanvasEmptyState } from "../CanvasEmptyState";
import { CanvasQuickAdd } from "../CanvasQuickAdd";
import { CanvasStatusBar } from "../CanvasStatusBar";

export const CanvasInner = () => {
  const { t } = useTranslation();
  const store = useHarnessCanvasStore();

  const pipelineName = useStore(store, (state) => state.pipelineName);
  const contextMenu = useStore(store, (state) => state.contextMenu);
  const connectionMenu = useStore(store, (state) => state.connectionMenu);
  const nodeContextMenu = useStore(store, (state) => state.nodeContextMenu);
  const isConsoleOpen = useStore(store, (state) => state.isConsoleOpen);
  const nodes = useStore(store, (state) => state.nodes);
  const setPipelineName = useStore(store, (state) => state.setPipelineName);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPipelineName(e.target.value);
  };

  return (
    <div className="relative h-full w-full">
      <CanvasFloatingMenu />

      <div className="pointer-events-none absolute left-16 top-4 z-40 flex w-[clamp(6rem,calc(50vw-16rem),14rem)] items-center max-[700px]:left-3 max-[700px]:top-[3.25rem] max-[700px]:w-[min(16rem,calc(100vw-1.5rem))]">
        <div className="pointer-events-auto flex w-full min-w-0 items-center gap-2 rounded-full border border-gray-200 bg-white/90 px-3 py-1.5 shadow-sm backdrop-blur-sm">
          <Input
            aria-label={t("canvas.pipelineTitle")}
            className="h-7 min-w-0 w-full border-none bg-transparent text-sm font-medium text-gray-700 shadow-none outline-none placeholder:text-gray-400"
            name="pipelineName"
            placeholder={t("canvas.pipelineTitlePlaceholder")}
            value={pipelineName}
            onChange={handleNameChange}
          />
        </div>
      </div>

      <CanvasToolbar />

      <CanvasFlow />

      {nodes.length === 0 && <CanvasEmptyState />}

      <CanvasQuickAdd />

      <CanvasStatusBar />

      {contextMenu && <CanvasContextMenu />}

      {connectionMenu && <ConnectionMenu />}

      {nodeContextMenu && <NodeContextMenu />}

      <LlmContentCard />

      {isConsoleOpen && <RunConsole />}
    </div>
  );
};
