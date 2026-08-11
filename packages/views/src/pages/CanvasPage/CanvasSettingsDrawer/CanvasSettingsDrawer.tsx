import {
  Grid3X3,
  Map,
  MousePointer2,
  PanelLeft,
  PanelRight,
  Settings2,
  X,
  Magnet,
  FileText,
} from "lucide-react";
import type { ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { Link } from "@tanstack/react-router";
import { Button } from "@repo/ui/button";
import { Label } from "@repo/ui/label";
import { Textarea } from "@repo/ui/textarea";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@repo/ui/sheet";
import { cn } from "@repo/ui/lib/utils";
import { useCanvasPageStore, type CanvasSettingsState } from "../_store";

const settingEntries = [
  { id: "showMiniMap" as const, icon: Map },
  { id: "showControls" as const, icon: MousePointer2 },
  { id: "showBackground" as const, icon: Grid3X3 },
  { id: "snapToGrid" as const, icon: Magnet },
];

const nodeCardModeOptions = [
  { id: "compact" as const, icon: PanelLeft },
  { id: "expanded" as const, icon: PanelRight },
];

export const CanvasSettingsDrawer = () => {
  const { t } = useTranslation();
  const store = useCanvasPageStore();
  const isOpen = useStore(store, (s) => s.isCanvasSettingsOpen);
  const pipelineSharedContext = useStore(store, (s) => s.pipelineSharedContext);
  const settings = useStore(store, (s) => s.canvasSettings);
  const nodeCardMode = useStore(store, (s) => s.nodeCardMode);
  const openCanvasSettings = useStore(store, (s) => s.openCanvasSettings);
  const handleCloseCanvasSettings = useStore(store, (s) => s.closeCanvasSettings);
  const handlePipelineSharedContextChange = useStore(
    store,
    (s) => s.handlePipelineSharedContextChange,
  );
  const updateCanvasSettings = useStore(store, (s) => s.updateCanvasSettings);
  const setNodeCardMode = useStore(store, (s) => s.setNodeCardMode);

  const handleOpenChange = (open: boolean) => {
    if (open) {
      openCanvasSettings();

      return;
    }

    handleCloseCanvasSettings();
  };

  const handleSettingChange = (
    id: keyof CanvasSettingsState,
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    updateCanvasSettings({
      [id]: event.target.checked,
    } as Partial<CanvasSettingsState>);
  };

  const handleNodeCardModeClick = (id: (typeof nodeCardModeOptions)[number]["id"]) => {
    setNodeCardMode(id);
  };

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetContent
        className="w-[min(24rem,calc(100vw-1rem))] max-w-sm gap-0 border-l bg-surface/95 p-0 backdrop-blur"
        showCloseButton={false}
        side="right"
      >
        <SheetHeader className="border-b pr-12">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-md bg-surface-2 text-muted-foreground ring-1 ring-border">
              <Settings2 className="size-4" />
            </span>
            <SheetTitle>{t("canvas.settingsDrawer.title")}</SheetTitle>
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

        <div
          aria-label={t("canvas.settingsDrawer.title")}
          className="flex-1 space-y-3 overflow-y-auto p-4"
          role="group"
        >
          <div className="rounded-lg bg-surface p-3 shadow-soft ring-1 ring-border">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-surface-2 text-muted-foreground">
                <FileText className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <Label className="text-foreground" htmlFor="pipeline-shared-context">
                  {t("canvas.settingsDrawer.pipelineSharedContext.label", {
                    defaultValue: "Pipeline shared context",
                  })}
                </Label>
                <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                  {t("canvas.settingsDrawer.pipelineSharedContext.description", {
                    defaultValue: "Context injected into every operation run in this pipeline.",
                  })}
                </p>
                <Textarea
                  className="mt-3 min-h-28 resize-y text-sm"
                  id="pipeline-shared-context"
                  name="pipelineSharedContext"
                  placeholder={t("canvas.settingsDrawer.pipelineSharedContext.placeholder", {
                    defaultValue: "Add pipeline-level instructions, constraints, or context...",
                  })}
                  value={pipelineSharedContext}
                  onChange={handlePipelineSharedContextChange}
                />
              </div>
            </div>
          </div>

          {settingEntries.map(({ id, icon: Icon }) => {
            const inputId = `canvas-setting-${id}`;
            const descriptionId = `${inputId}-description`;

            return (
              <div
                key={id}
                className="flex items-start gap-3 rounded-lg bg-surface p-3 shadow-soft ring-1 ring-border"
              >
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-surface-2 text-muted-foreground">
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <Label className="text-foreground" htmlFor={inputId}>
                    {t(`canvas.settingsDrawer.${id}.label`)}
                  </Label>
                  <p className="mt-0.5 text-xs leading-5 text-muted-foreground" id={descriptionId}>
                    {t(`canvas.settingsDrawer.${id}.description`)}
                  </p>
                </div>
                <input
                  aria-describedby={descriptionId}
                  checked={settings[id]}
                  className={cn(
                    "mt-1 size-4 rounded border-input bg-background text-primary",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  )}
                  id={inputId}
                  type="checkbox"
                  onChange={(event) => handleSettingChange(id, event)}
                />
              </div>
            );
          })}

          <div className="rounded-lg bg-surface p-3 shadow-soft ring-1 ring-border">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-surface-2 text-muted-foreground">
                <PanelLeft className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <Label className="text-foreground">
                  {t("canvas.settingsDrawer.nodeCardMode.label", {
                    defaultValue: "Node card mode",
                  })}
                </Label>
                <div className="mt-3 grid grid-cols-2 overflow-hidden rounded-md bg-surface-2 p-1 ring-1 ring-border">
                  {nodeCardModeOptions.map(({ id, icon: Icon }) => (
                    <Button
                      key={id}
                      aria-pressed={nodeCardMode === id}
                      className="h-8 gap-1.5"
                      size="sm"
                      type="button"
                      variant={nodeCardMode === id ? "secondary" : "ghost"}
                      onClick={() => handleNodeCardModeClick(id)}
                    >
                      <Icon className="size-3.5" />
                      {t(`canvas.settingsDrawer.nodeCardMode.${id}`, {
                        defaultValue: id === "compact" ? "Compact" : "Expanded",
                      })}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t bg-surface-2/60 p-4">
          <Link
            className="inline-flex h-8 items-center justify-center rounded-lg bg-background px-3 text-sm font-medium text-foreground ring-1 ring-border transition-colors hover:bg-muted"
            to="/settings"
            onClick={handleCloseCanvasSettings}
          >
            {t("canvas.settingsDrawer.globalSettings")}
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  );
};
