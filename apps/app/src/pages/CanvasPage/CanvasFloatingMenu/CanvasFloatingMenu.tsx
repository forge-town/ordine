import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { useCanvasPageStore } from "../_store";
import { Menu, Home, Save, FileDown, FileUp, Settings, Undo, Redo } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useCreate, useUpdate } from "@refinedev/core";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui/popover";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { ResourceName } from "@/integrations/refine/dataProvider";
import { toastStore } from "@/store/toastStore";
import { ResultAsync } from "neverthrow";
import {
  isCanvasImportFileTooLarge,
  parseCanvasImportJson,
  type CanvasImportError,
} from "../utils/canvasImportJson";

export const CanvasFloatingMenu = () => {
  const { t } = useTranslation();
  const store = useCanvasPageStore();
  const pipelineId = useStore(store, (state) => state.pipelineId);
  const pipelineName = useStore(store, (state) => state.pipelineName);
  const nodes = useStore(store, (state) => state.nodes);
  const edges = useStore(store, (state) => state.edges);
  const exportCanvas = useStore(store, (state) => state.exportCanvas);
  const importCanvas = useStore(store, (state) => state.importCanvas);
  const handleUndo = useStore(store, (state) => state.handleUndo);
  const handleRedo = useStore(store, (state) => state.handleRedo);
  const openCanvasSettings = useStore(store, (state) => state.openCanvasSettings);
  const handlePipelineIdChange = useStore(store, (state) => state.handlePipelineIdChange);

  const { mutate: updateCanvas, mutation: updateMutation } = useUpdate();
  const { mutate: createCanvas, mutation: createMutation } = useCreate();

  const [isOpen, setIsOpen] = useState(false);
  const displayPipelineName = pipelineName || t("canvas.pipelineTitlePlaceholder");

  const handleSave = () => {
    if (pipelineId) {
      updateCanvas({
        resource: ResourceName.pipelines,
        id: pipelineId,
        values: { nodes, edges },
        successNotification: {
          type: "success",
          message: t("canvas.saveSuccess"),
          description: t("canvas.floatingMenu.saveSuccessDescription", {
            name: displayPipelineName,
          }),
        },
        errorNotification: {
          type: "error",
          message: t("canvas.saveFailed"),
          description: t("canvas.floatingMenu.saveFailedDescription"),
        },
      });
    } else {
      const newId = crypto.randomUUID();
      createCanvas(
        {
          resource: ResourceName.pipelines,
          values: {
            id: newId,
            name: displayPipelineName,
            description: "",
            tags: [],
            timeoutMs: null,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            nodes,
            edges,
          },
          successNotification: {
            type: "success",
            message: t("canvas.saveSuccess"),
            description: t("canvas.floatingMenu.createSuccessDescription", {
              name: displayPipelineName,
            }),
          },
          errorNotification: {
            type: "error",
            message: t("canvas.saveFailed"),
            description: t("canvas.floatingMenu.saveFailedDescription"),
          },
        },
        {
          onSuccess: () => {
            handlePipelineIdChange(newId);
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

  const showImportError = (error: CanvasImportError) => {
    const description =
      error === "invalid-json"
        ? t("canvas.importInvalidJson")
        : error === "file-too-large"
          ? t("canvas.importFileTooLarge")
          : t("canvas.importInvalidPipelineJson");

    toastStore.getState().addToast({
      type: "error",
      title: t("canvas.importFailed"),
      description,
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setIsOpen(false);

    if (isCanvasImportFileTooLarge(file)) {
      showImportError("file-too-large");

      return;
    }

    void ResultAsync.fromPromise(file.text(), () => "invalid-json" as const)
      .andThen((text) => parseCanvasImportJson(text))
      .match(importCanvas, showImportError);
  };

  const menuItems = [
    { icon: Home, label: t("canvas.floatingMenu.backToWorkspace"), to: "/" },
    {
      icon: Save,
      label: t("canvas.floatingMenu.save"),
      onClick: handleSave,
      disabled: isPending,
    },
    { icon: FileDown, label: t("canvas.floatingMenu.export"), onClick: exportCanvas },
    { icon: FileUp, label: t("canvas.floatingMenu.import"), onClick: handleImport },
    { icon: Undo, label: t("canvas.undo"), onClick: handleUndo, divider: true },
    { icon: Redo, label: t("canvas.redo"), onClick: handleRedo },
    { icon: Settings, label: t("canvas.settingsDrawer.menuLabel"), onClick: openCanvasSettings },
  ];

  const handleCloseMenu = () => setIsOpen(false);
  const handleOpenChange = (v: boolean) => setIsOpen(v);
  const handleItemClick = (onClick?: () => void) => () => {
    onClick?.();
    setIsOpen(false);
  };

  return (
    <div className="pointer-events-auto" data-testid="canvas-floating-menu">
      <Popover open={isOpen} onOpenChange={handleOpenChange}>
        <PopoverTrigger
          className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white shadow-md transition-all hover:bg-gray-50 hover:shadow-lg active:scale-95"
          title={t("canvas.floatingMenu.menu")}
        >
          <Menu className="h-5 w-5 text-gray-700" />
        </PopoverTrigger>

        <PopoverContent align="start" className="w-48 p-2" side="bottom" sideOffset={8}>
          {menuItems.map((item, index) => (
            <div key={item.label}>
              {item.divider && index > 0 && <div className="my-1 border-t border-gray-100" />}
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
                <Button
                  className="flex h-auto w-full items-center justify-start gap-3 px-4 py-2 text-sm text-gray-700"
                  disabled={item.disabled}
                  variant="ghost"
                  onClick={handleItemClick(item.onClick)}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Button>
              )}
            </div>
          ))}
        </PopoverContent>
      </Popover>
      <Input
        ref={fileInputRef}
        accept=".json"
        aria-label={t("canvas.floatingMenu.importJson")}
        className="hidden"
        name="canvasImportFile"
        type="file"
        onChange={handleFileChange}
      />
    </div>
  );
};
