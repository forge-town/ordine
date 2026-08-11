import {
  Activity,
  Bot,
  BookOpen,
  Box,
  Boxes,
  Cpu,
  FileDown,
  FileUp,
  FlaskConical,
  Gauge,
  Home,
  Layers,
  Plug,
  Puzzle,
  Redo2,
  Save,
  Settings2,
  Undo2,
  Workflow,
  X,
  Zap,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
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
import { useCanvasPageStore } from "../_store";
import { CANVAS_WORKSPACE_SIDEBAR_ID } from "../CanvasMiniSidebar";
import { useCanvasWorkspacePersistence } from "../useCanvasWorkspacePersistence";

const workspaceGroups = [
  {
    labelKey: "nav.groups.assembly",
    links: [
      { icon: Layers, labelKey: "nav.pipelines", to: "/pipelines" },
      { icon: Boxes, labelKey: "nav.components", to: "/components" },
      { icon: Zap, labelKey: "nav.operations", to: "/pipelines/operations" },
      { icon: Box, labelKey: "nav.objects", to: "/pipelines/objects" },
    ],
  },
  {
    labelKey: "nav.groups.monitor",
    links: [
      { icon: Activity, labelKey: "nav.jobs", to: "/pipelines/jobs" },
      { icon: Gauge, labelKey: "nav.items.usage", to: "/usage" },
      { icon: FlaskConical, labelKey: "nav.distillations", to: "/distillations" },
    ],
  },
  {
    labelKey: "nav.groups.capabilities",
    links: [
      { icon: Bot, labelKey: "nav.agents", to: "/agents" },
      { icon: Cpu, labelKey: "nav.items.localAgents", to: "/local-agents" },
      { icon: BookOpen, labelKey: "nav.skills", to: "/skills" },
      { icon: Plug, labelKey: "nav.items.connectors", to: "/connectors" },
      { icon: Puzzle, labelKey: "nav.plugins", to: "/plugins" },
    ],
  },
] as const;

export const CanvasWorkspaceSidebarOverlay = () => {
  const { t } = useTranslation();
  const store = useCanvasPageStore();
  const isOpen = useStore(store, (state) => state.isWorkspaceSidebarOpen);
  const closeWorkspaceSidebar = useStore(store, (state) => state.closeWorkspaceSidebar);
  const pipelineName = useStore(store, (state) => state.pipelineName);
  const exportCanvas = useStore(store, (state) => state.exportCanvas);
  const handleUndo = useStore(store, (state) => state.handleUndo);
  const handleRedo = useStore(store, (state) => state.handleRedo);
  const openCanvasSettings = useStore(store, (state) => state.openCanvasSettings);
  const displayPipelineName = pipelineName || t("canvas.pipelineTitlePlaceholder");
  const { fileInputRef, handleImport, handleImportFileChange, handleSave, isPending } =
    useCanvasWorkspacePersistence({
      onAfterImportFileSelect: closeWorkspaceSidebar,
      onAfterSave: closeWorkspaceSidebar,
    });

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      closeWorkspaceSidebar();
    }
  };

  const handleCloseDrawer = () => {
    closeWorkspaceSidebar();
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
        id={CANVAS_WORKSPACE_SIDEBAR_ID}
        showCloseButton={false}
        side="left"
      >
        <SheetHeader className="border-b px-4 py-4 pr-12">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Workflow className="size-4" />
            </span>
            <div className="min-w-0">
              <SheetTitle>
                {t("canvas.workspaceSidebar.title", {
                  defaultValue: "Workspace",
                })}
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

          {workspaceGroups.map((group) => (
            <section key={group.labelKey} className="space-y-1.5">
              <p className="px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {t(group.labelKey)}
              </p>
              <div className="grid gap-0.5">
                {group.links.map((item) => {
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.to}
                      className="flex h-8 items-center gap-2 rounded-md px-2 text-[12.5px] text-foreground hover:bg-muted"
                      to={item.to}
                      onClick={handleCloseDrawer}
                    >
                      <Icon className="size-3.5 text-muted-foreground" />
                      <span>{t(item.labelKey)}</span>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        <div className="grid gap-1 border-t p-3">
          <Link
            className="flex h-8 items-center gap-2 rounded-md px-2 text-[12.5px] text-foreground hover:bg-muted"
            to="/settings"
            onClick={handleCloseDrawer}
          >
            <Settings2 className="size-3.5 text-muted-foreground" />
            {t("nav.settings")}
          </Link>
          <Link
            className="inline-flex h-8 w-full items-center justify-center gap-2 rounded-md bg-surface-2 px-3 text-[12.5px] font-medium ring-1 ring-border hover:bg-muted"
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
          onChange={handleImportFileChange}
        />
      </SheetContent>
    </Sheet>
  );
};
