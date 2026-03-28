import { useStore } from "zustand";
import { useHarnessCanvasStore } from "./_store";
import { cn } from "@/lib/cn";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Trash2,
  Download,
  Undo2,
  Redo2,
  Bot,
  Settings,
} from "lucide-react";

interface CanvasToolbarProps {
  onFitView?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
}

export const CanvasToolbar = ({
  onFitView,
  onZoomIn,
  onZoomOut,
}: CanvasToolbarProps) => {
  const store = useHarnessCanvasStore();
  const selectedNodeId = useStore(store, (state) => state.selectedNodeId);
  const isAiAssistantOpen = useStore(store, (state) => state.isAiAssistantOpen);

  const handleDeleteSelected = () => {
    if (selectedNodeId) {
      store.getState().removeNode(selectedNodeId);
    }
  };

  const handleToggleAi = () => {
    store.getState().toggleAiAssistant();
  };

  return (
    <div className="absolute left-1/2 top-3 z-10 -translate-x-1/2">
      <div className="flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-2 py-1.5 shadow-md">
        {/* Zoom controls */}
        <button
          onClick={onZoomOut}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
          title="缩小"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <button
          onClick={onZoomIn}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
          title="放大"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <button
          onClick={onFitView}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
          title="适合视图"
        >
          <Maximize2 className="h-4 w-4" />
        </button>

        <div className="mx-1 h-5 w-px bg-gray-200" />

        {/* History controls */}
        <button
          className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 transition-colors disabled:opacity-50"
          title="撤销"
          disabled
        >
          <Undo2 className="h-4 w-4" />
        </button>
        <button
          className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 transition-colors disabled:opacity-50"
          title="重做"
          disabled
        >
          <Redo2 className="h-4 w-4" />
        </button>

        <div className="mx-1 h-5 w-px bg-gray-200" />

        {/* Delete */}
        <button
          onClick={handleDeleteSelected}
          disabled={!selectedNodeId}
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-lg transition-colors",
            selectedNodeId
              ? "text-red-500 hover:bg-red-50"
              : "text-gray-300 cursor-not-allowed",
          )}
          title="删除选中"
        >
          <Trash2 className="h-4 w-4" />
        </button>

        <button
          className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
          title="导出"
        >
          <Download className="h-4 w-4" />
        </button>

        <div className="mx-1 h-5 w-px bg-gray-200" />

        {/* AI Assistant */}
        <button
          onClick={handleToggleAi}
          className={cn(
            "flex h-7 items-center gap-1.5 rounded-lg px-2 text-xs font-medium transition-colors",
            isAiAssistantOpen
              ? "bg-blue-500 text-white hover:bg-blue-600"
              : "text-blue-600 hover:bg-blue-50",
          )}
          title="AI 设计助手"
        >
          <Bot className="h-3.5 w-3.5" />
          <span>AI</span>
        </button>
      </div>
    </div>
  );
};
