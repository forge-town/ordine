import { useState, useRef, useEffect } from "react";
import { useStore } from "zustand";
import {
  Menu,
  Home,
  Save,
  FileDown,
  Settings,
  Undo,
  Redo,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useHarnessCanvasStore } from "../_store";

export const CanvasFloatingMenu = () => {
  const store = useHarnessCanvasStore();
  const saveCanvas = useStore(store, (state) => state.saveCanvas);
  const exportCanvas = useStore(store, (state) => state.exportCanvas);
  const undo = useStore(store, (state) => state.undo);
  const redo = useStore(store, (state) => state.redo);
  const pipelineId = useStore(store, (state) => state.pipelineId);

  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const onSave = pipelineId ? saveCanvas : undefined;

  const menuItems = [
    { icon: Home, label: "回到工作区", to: "/" },
    { icon: Save, label: "保存", onClick: onSave },
    { icon: FileDown, label: "导出", onClick: exportCanvas },
    { icon: Undo, label: "撤销", onClick: undo, divider: true },
    { icon: Redo, label: "重做", onClick: redo },
    { icon: Settings, label: "设置", to: "/settings" },
  ];

  return (
    <div ref={menuRef} className="fixed left-4 top-4 z-50">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white shadow-md transition-all hover:bg-gray-50 hover:shadow-lg active:scale-95"
        title="菜单"
      >
        <Menu className="h-5 w-5 text-gray-700" />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-12 w-48 rounded-lg border border-gray-200 bg-white py-2 shadow-lg">
          {menuItems.map((item, index) => (
            <div key={item.label}>
              {item.divider && index > 0 && (
                <div className="my-1 border-t border-gray-100" />
              )}
              {item.to ? (
                <Link
                  to={item.to}
                  className="flex w-full items-center gap-3 px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50"
                  onClick={() => setIsOpen(false)}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              ) : (
                <button
                  onClick={() => {
                    item.onClick?.();
                    setIsOpen(false);
                  }}
                  className="flex w-full items-center gap-3 px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50"
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
