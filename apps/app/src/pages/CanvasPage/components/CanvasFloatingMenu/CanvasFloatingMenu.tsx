import { useState, useRef, useEffect } from "react";
import { useStore } from "zustand";
import {
  Menu,
  Home,
  Save,
  FileDown,
  FileUp,
  Settings,
  Undo,
  Redo,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useCreate, useUpdate } from "@refinedev/core";
import { useHarnessCanvasStore } from "../../_store";
import { ResourceName } from "@/integrations/refine/dataProvider";
import type { PipelineNode, PipelineEdge } from "../../_store/canvasSlice";

export const CanvasFloatingMenu = () => {
  const store = useHarnessCanvasStore();
  const pipelineId = useStore(store, (state) => state.pipelineId);
  const pipelineName = useStore(store, (state) => state.pipelineName);
  const nodes = useStore(store, (state) => state.nodes);
  const edges = useStore(store, (state) => state.edges);
  const exportCanvas = useStore(store, (state) => state.exportCanvas);
  const importCanvas = useStore(store, (state) => state.importCanvas);
  const undo = useStore(store, (state) => state.undo);
  const redo = useStore(store, (state) => state.redo);
  const setPipelineId = useStore(store, (state) => state.setPipelineId);

  const { mutate: updateCanvas, mutation: updateMutation } = useUpdate();
  const { mutate: createCanvas, mutation: createMutation } = useCreate();

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

  const handleSave = () => {
    if (pipelineId) {
      updateCanvas({
        resource: ResourceName.pipelines,
        id: pipelineId,
        values: { nodes, edges },
        successNotification: {
          type: "success",
          message: "保存成功",
          description: `Pipeline「${pipelineName || "无标题"}」已保存`,
        },
        errorNotification: {
          type: "error",
          message: "保存失败",
          description: "请稍后重试",
        },
      });
    } else {
      const newId = crypto.randomUUID();
      createCanvas(
        {
          resource: ResourceName.pipelines,
          values: {
            id: newId,
            name: pipelineName || "无标题",
            description: "",
            tags: [],
            nodeCount: nodes.length,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            nodes,
            edges,
          },
          successNotification: {
            type: "success",
            message: "保存成功",
            description: `Pipeline「${pipelineName || "无标题"}」已创建`,
          },
          errorNotification: {
            type: "error",
            message: "保存失败",
            description: "请稍后重试",
          },
        },
        {
          onSuccess: () => {
            setPipelineId(newId);
          },
        },
      );
    }
  };

  const isPending = updateMutation.isPending || createMutation.isPending;

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result;
      if (typeof text !== "string") return;
      const parsed = JSON.parse(text) as {
        nodes?: PipelineNode[];
        edges?: PipelineEdge[];
      };
      importCanvas({
        nodes: parsed.nodes ?? [],
        edges: parsed.edges ?? [],
      });
    };
    reader.readAsText(file);
    e.target.value = "";
    setIsOpen(false);
  };

  const menuItems = [
    { icon: Home, label: "回到工作区", to: "/" },
    {
      icon: Save,
      label: "保存",
      onClick: handleSave,
      disabled: isPending,
    },
    { icon: FileDown, label: "导出", onClick: exportCanvas },
    { icon: FileUp, label: "导入", onClick: handleImport },
    { icon: Undo, label: "撤销", onClick: undo, divider: true },
    { icon: Redo, label: "重做", onClick: redo },
    { icon: Settings, label: "设置", to: "/settings" },
  ];

  const handleToggleOpen = () => setIsOpen((v) => !v);
  const handleCloseMenu = () => setIsOpen(false);
  const handleItemClick = (onClick?: () => void) => () => {
    onClick?.();
    setIsOpen(false);
  };

  return (
    <div ref={menuRef} className="fixed left-4 top-4 z-50">
      <button
        className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white shadow-md transition-all hover:bg-gray-50 hover:shadow-lg active:scale-95"
        title="菜单"
        onClick={handleToggleOpen}
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
                  className="flex w-full items-center gap-3 px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50"
                  to={item.to}
                  onClick={handleCloseMenu}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              ) : (
                <button
                  className="flex w-full items-center gap-3 px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={item.disabled}
                  onClick={handleItemClick(item.onClick)}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      <input
        ref={fileInputRef}
        accept=".json"
        className="hidden"
        type="file"
        onChange={handleFileChange}
      />
    </div>
  );
};
