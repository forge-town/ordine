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

export const CanvasInner = () => {
  const { t } = useTranslation();
  const store = useHarnessCanvasStore();

  const pipelineName = useStore(store, (state) => state.pipelineName);
  const contextMenu = useStore(store, (state) => state.contextMenu);
  const connectionMenu = useStore(store, (state) => state.connectionMenu);
  const nodeContextMenu = useStore(store, (state) => state.nodeContextMenu);
  const isConsoleOpen = useStore(store, (state) => state.isConsoleOpen);
  const setPipelineName = useStore(store, (state) => state.setPipelineName);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPipelineName(e.target.value);
  };

  return (
    <div className="relative h-full w-full">
      <CanvasFloatingMenu />

      <div className="pointer-events-none absolute left-16 right-4 top-4 z-40 flex items-center justify-between">
        <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-gray-200 bg-white/90 px-4 py-1.5 shadow-sm backdrop-blur-sm">
          <Input
            className="w-48 bg-transparent text-sm font-medium text-gray-700 outline-none placeholder:text-gray-400 border-none shadow-none"
            placeholder={t("canvas.pipelineTitlePlaceholder")}
            value={pipelineName}
            onChange={handleNameChange}
          />
        </div>
      </div>

      <CanvasToolbar />

      <CanvasFlow />

      {contextMenu && <CanvasContextMenu />}

      {connectionMenu && <ConnectionMenu />}

      {nodeContextMenu && <NodeContextMenu />}

      <LlmContentCard />

      {isConsoleOpen && <RunConsole />}
    </div>
  );
};
