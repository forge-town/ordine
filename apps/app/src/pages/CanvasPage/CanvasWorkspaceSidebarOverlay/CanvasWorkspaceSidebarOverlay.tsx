import { useRef } from "react";
import {
  Activity,
  Bot,
  BookOpen,
  FileDown,
  FileUp,
  Home,
  LayoutDashboard,
  Layers,
  Puzzle,
  Redo2,
  Save,
  Server,
  Settings2,
  Undo2,
  Workflow,
  X,
  Zap,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useCreate, useUpdate } from "@refinedev/core";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { ResultAsync } from "neverthrow";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { Separator } from "@repo/ui/separator";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@repo/ui/sheet";
import { ResourceName } from "@/integrations/refine/dataProvider";
import { toastStore } from "@/store/toastStore";
import { useCanvasPageStore } from "../_store";
import {
  isCanvasImportFileTooLarge,
  parseCanvasImportJson,
  type CanvasImportError,
} from "../utils/canvasImportJson";

const workspaceLinks = [
  { icon: LayoutDashboard, labelKey: "nav.dashboard", to: "/" },
  { icon: Layers, labelKey: "nav.pipelines", to: "/pipelines" },
  { icon: BookOpen, labelKey: "nav.skills", to: "/skills" },
  { icon: Zap, labelKey: "nav.operations", to: "/pipelines/operations" },
  { icon: Activity, labelKey: "nav.jobs", to: "/pipelines/jobs" },
  { icon: Bot, labelKey: "nav.agents", to: "/agents" },
  { icon: Puzzle, labelKey: "nav.plugins", to: "/plugins" },
  { icon: Server, labelKey: "nav.runtimes", to: "/runtimes" },
  { icon: Settings2, labelKey: "nav.settings", to: "/settings" },
] as const;

export const CanvasWorkspaceSidebarOverlay = () => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const store = useCanvasPageStore();
  const isOpen = useStore(store, (state) => state.isWorkspaceSidebarOpen);
  const closeWorkspaceSidebar = useStore(store, (state) => state.closeWorkspaceSidebar);
  const pipelineId = useStore(store, (state) => state.pipelineId);
  const pipelineName = useStore(store, (state) => state.pipelineName);
  const nodes = useStore(store, (state) => state.nodes);
  const edges = useStore(store, (state) => state.edges);
  const exportCanvas = useStore(store, (state) => state.exportCanvas);
  const importCanvas = useStore(store, (state) => state.importCanvas);
  const handleUndo = useStore(store, (state) => state.handleUndo);
  const handleRedo = useStore(store, (state) => state.handleRedo);
  const handlePipelineIdChange = useStore(store, (state) => state.handlePipelineIdChange);
  const openCanvasSettings = useStore(store, (state) => state.openCanvasSettings);

  const { mutate: updateCanvas, mutation: updateMutation } = useUpdate();
  const { mutate: createCanvas, mutation: createMutation } = useCreate();
  const displayPipelineName = pipelineName || t("canvas.pipelineTitlePlaceholder");
  const isPending = updateMutation.isPending || createMutation.isPending;

  const handleCloseDrawer = () => {
    closeWorkspaceSidebar();
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      handleCloseDrawer();
    }
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
      handleCloseDrawer();

      return;
    }

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
    handleCloseDrawer();
  };

  const handleImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    event.target.value = "";
    handleCloseDrawer();

    if (isCanvasImportFileTooLarge(file)) {
      showImportError("file-too-large");

      return;
    }

    void ResultAsync.fromPromise(file.text(), () => "invalid-json" as const)
      .andThen((text) => parseCanvasImportJson(text))
      .match(importCanvas, showImportError);
  };

  const handleActionClick = (action: () => void) => () => {
    action();
    handleCloseDrawer();
  };

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetContent
        className="flex w-[min(22rem,calc(100vw-1rem))] flex-col gap-0 border-r bg-background/95 p-0 backdrop-blur"
        data-testid="canvas-workspace-sidebar-overlay"
        side="left"
      >
        <SheetHeader className="border-b px-4 py-4 pr-12">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Workflow className="size-4" />
            </span>
            <div className="min-w-0">
              <SheetTitle>
                {t("canvas.workspaceSidebar.title", { defaultValue: "Workspace" })}
              </SheetTitle>
              <SheetDescription className="truncate">{displayPipelineName}</SheetDescription>
            </div>
          </div>
          <SheetClose
            render={
              <Button
                aria-label={t("canvas.settingsDrawer.close")}
                className="absolute right-3 top-3"
                size="icon-sm"
                variant="ghost"
              />
            }
          >
            <X className="size-4" />
          </SheetClose>
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <section className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("canvas.floatingMenu.menu", { defaultValue: "Canvas" })}
            </p>
            <div className="grid gap-2">
              <Button
                className="justify-start gap-2"
                disabled={isPending}
                variant="secondary"
                onClick={handleSave}
              >
                <Save className="size-4" />
                {t("canvas.floatingMenu.save")}
              </Button>
              <Button
                className="justify-start gap-2"
                variant="ghost"
                onClick={handleActionClick(exportCanvas)}
              >
                <FileDown className="size-4" />
                {t("canvas.floatingMenu.export")}
              </Button>
              <Button className="justify-start gap-2" variant="ghost" onClick={handleImport}>
                <FileUp className="size-4" />
                {t("canvas.floatingMenu.import")}
              </Button>
              <Separator />
              <Button
                className="justify-start gap-2"
                variant="ghost"
                onClick={handleActionClick(handleUndo)}
              >
                <Undo2 className="size-4" />
                {t("canvas.undo")}
              </Button>
              <Button
                className="justify-start gap-2"
                variant="ghost"
                onClick={handleActionClick(handleRedo)}
              >
                <Redo2 className="size-4" />
                {t("canvas.redo")}
              </Button>
              <Button
                className="justify-start gap-2"
                variant="ghost"
                onClick={handleActionClick(openCanvasSettings)}
              >
                <Settings2 className="size-4" />
                {t("canvas.settingsDrawer.menuLabel")}
              </Button>
            </div>
          </section>

          <section className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("nav.workspace")}
            </p>
            <div className="grid gap-1">
              {workspaceLinks.map((item) => {
                const Icon = item.icon;

                return (
                  <Link
                    key={item.to}
                    className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground hover:bg-muted"
                    to={item.to}
                    onClick={handleCloseDrawer}
                  >
                    <Icon className="size-4" />
                    <span>{t(item.labelKey)}</span>
                  </Link>
                );
              })}
            </div>
          </section>
        </div>

        <div className="border-t p-4">
          <Link
            className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border bg-background px-3 text-sm font-medium hover:bg-muted"
            to="/"
            onClick={handleCloseDrawer}
          >
            <Home className="size-4" />
            {t("canvas.floatingMenu.backToWorkspace")}
          </Link>
        </div>

        <Input
          ref={fileInputRef}
          accept=".json"
          aria-label={t("canvas.floatingMenu.importJson")}
          className="hidden"
          name="canvasImportFile"
          type="file"
          onChange={handleFileChange}
        />
      </SheetContent>
    </Sheet>
  );
};
