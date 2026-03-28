import { Settings, Save, FolderOpen } from "lucide-react";

export const HarnessCanvasHeader = () => {
  return (
    <header className="flex h-11 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4">
      <div className="flex items-center gap-2.5">
        <div className="flex items-center gap-1">
          <span className="text-sm font-semibold text-gray-800">Canvas</span>
          <span className="text-gray-300">/</span>
          <span className="text-sm text-gray-500">无标题 Pipeline</span>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button className="flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs text-gray-600 hover:bg-gray-100 transition-colors">
          <FolderOpen className="h-3.5 w-3.5" />
          打开
        </button>
        <button className="flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs text-gray-600 hover:bg-gray-100 transition-colors">
          <Save className="h-3.5 w-3.5" />
          保存
        </button>
        <div className="mx-1 h-4 w-px bg-gray-200" />
        <button className="flex h-7 w-7 items-center justify-center rounded-md text-gray-600 hover:bg-gray-100 transition-colors">
          <Settings className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
};
